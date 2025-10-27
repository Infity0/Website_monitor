from flask import Flask, render_template, request, jsonify, redirect, url_for, make_response
from models import db, Website, WebsiteCheck
from config import Config
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import requests
import time
from datetime import datetime, timedelta, timezone
import logging
import atexit
import csv
from io import StringIO
import json
import pytz
from tzlocal import get_localzone

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

# Initialize scheduler
scheduler = BackgroundScheduler()
scheduler.start()

# Register shutdown function
atexit.register(lambda: scheduler.shutdown())

# Add CORS headers to prevent duplicate requests
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

def check_website(website_id):
    """Check a single website and record results"""
    with app.app_context():
        website = Website.query.get(website_id)
        if not website or not website.is_active:
            return

        start_time = time.time()
        try:
            response = requests.get(
                website.url,
                timeout=10,
                headers={'User-Agent': 'WebsiteMonitor/1.0'},
                allow_redirects=True
            )
            response_time = time.time() - start_time
            status_code = response.status_code
            is_up = 200 <= status_code < 400
            error_message = None

            logger.info(f"Checked {website.url}: Status {status_code}, Response time: {response_time:.2f}s")

        except requests.exceptions.RequestException as e:
            response_time = time.time() - start_time
            status_code = None
            is_up = False
            error_message = str(e)
            logger.warning(f"Failed to check {website.url}: {error_message}")

        # Save check result
        check = WebsiteCheck(
            website_id=website.id,
            status_code=status_code,
            response_time=response_time,
            is_up=is_up,
            error_message=error_message
        )
        db.session.add(check)
        db.session.commit()

def check_all_websites():
    """Check all active websites"""
    with app.app_context():
        active_websites = Website.query.filter_by(is_active=True).all()
        for website in active_websites:
            check_website(website.id)

def schedule_website_checks():
    """Schedule periodic checks for all websites"""
    # Remove existing jobs
    scheduler.remove_all_jobs()

    # Schedule checks for each website based on its interval
    websites = Website.query.all()
    for website in websites:
        if website.is_active:
            scheduler.add_job(
                func=check_website,
                trigger=IntervalTrigger(minutes=website.check_interval),
                args=[website.id],
                id=f'website_{website.id}',
                replace_existing=True,
                misfire_grace_time=60
            )
            logger.info(f"Scheduled check for {website.url} every {website.check_interval} minutes")

def calculate_real_uptime(website_id, hours=24):
    """Более точный расчет аптайма"""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    checks = WebsiteCheck.query.filter(
        WebsiteCheck.website_id == website_id,
        WebsiteCheck.checked_at >= since
    ).order_by(WebsiteCheck.checked_at.asc()).all()

    if not checks:
        return 0

    # Рассчитываем аптайм на основе временных интервалов
    total_time = timedelta(hours=hours)
    downtime = timedelta(0)

    for i in range(len(checks) - 1):
        current_check = checks[i]
        next_check = checks[i + 1]

        if not current_check.is_up:
            # Предполагаем, что сайт был недоступен до следующей проверки
            check_interval = next_check.checked_at - current_check.checked_at
            downtime += check_interval

    uptime_percent = ((total_time - downtime).total_seconds() / total_time.total_seconds()) * 100
    return round(uptime_percent, 2)

def get_local_time():
    """Получить текущее локальное время"""
    return datetime.now()

def utc_to_local(utc_dt):
    """Convert UTC datetime to local timezone"""
    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
    local_tz = get_localzone()
    return utc_dt.astimezone(local_tz)

@app.route('/')
def index():
    """Dashboard page"""
    websites = Website.query.all()

    # Get recent stats for each website
    website_stats = []
    for website in websites:
        recent_checks = WebsiteCheck.query.filter_by(website_id=website.id) \
            .order_by(WebsiteCheck.checked_at.desc()) \
            .limit(10) \
            .all()

        # Используем улучшенный расчет аптайма
        uptime_24h = calculate_real_uptime(website.id, hours=24)

        website_stats.append({
            'website': website,
            'recent_checks': recent_checks,
            'uptime_24h': uptime_24h,
            'last_check': recent_checks[0] if recent_checks else None
        })

    return render_template('dashboard.html', website_stats=website_stats)

@app.route('/websites')
def list_websites():
    """List all monitored websites"""
    websites = Website.query.all()
    return render_template('index.html', websites=websites)

@app.route('/websites/add', methods=['GET', 'POST'])
def add_website():
    """Add a new website to monitor"""
    if request.method == 'POST':
        name = request.form.get('name')
        url = request.form.get('url')
        check_interval = int(request.form.get('check_interval', 5))

        # Basic URL validation
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        website = Website(
            name=name,
            url=url,
            check_interval=check_interval
        )

        db.session.add(website)
        db.session.commit()

        # Reschedule checks
        schedule_website_checks()

        # Perform initial check
        check_website(website.id)

        return redirect(url_for('list_websites'))

    return render_template('add_site.html')

@app.route('/websites/<int:website_id>/toggle', methods=['POST'])
def toggle_website(website_id):
    """Toggle website monitoring on/off"""
    website = Website.query.get_or_404(website_id)
    website.is_active = not website.is_active
    db.session.commit()

    # Reschedule checks
    schedule_website_checks()

    return jsonify({'success': True, 'is_active': website.is_active})

@app.route('/websites/<int:website_id>/delete', methods=['POST'])
def delete_website(website_id):
    """Delete a website and its check history"""
    website = Website.query.get_or_404(website_id)
    db.session.delete(website)
    db.session.commit()

    # Reschedule checks
    schedule_website_checks()

    return jsonify({'success': True})

@app.route('/websites/<int:website_id>/checks')
def get_website_checks(website_id):
    """Get check history for a website"""
    checks = WebsiteCheck.query.filter_by(website_id=website_id) \
        .order_by(WebsiteCheck.checked_at.desc()) \
        .limit(50) \
        .all()

    return jsonify([check.to_dict() for check in checks])

@app.route('/websites/<int:website_id>/check-now', methods=['POST'])
def check_website_now(website_id):
    """Manually trigger a website check"""
    try:
        check_website(website_id)
        return jsonify({'success': True, 'message': 'Check completed'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/status')
def api_status():
    """API endpoint for overall system status"""
    total_websites = Website.query.count()
    active_websites = Website.query.filter_by(is_active=True).count()

    # Calculate overall uptime
    total_checks = WebsiteCheck.query.count()
    up_checks = WebsiteCheck.query.filter_by(is_up=True).count()
    overall_uptime = (up_checks / total_checks * 100) if total_checks > 0 else 0

    return jsonify({
        'total_websites': total_websites,
        'active_websites': active_websites,
        'overall_uptime': round(overall_uptime, 2)
    })

@app.route('/api/uptime-stats')
def api_uptime_stats():
    """API для получения реальной статистики аптайма из базы данных"""
    try:
        period = request.args.get('period', '24h')

        # Используем локальное время
        now_local = get_local_time()

        # Определяем параметры периода
        if period == '24h':
            hours = 24
            points = 12  # Каждые 2 часа
            time_format = '%H:%M'
            start_time = now_local - timedelta(hours=hours)
        elif period == '7d':
            hours = 24 * 7
            points = 7  # Каждый день
            time_format = '%d.%m'
            start_time = now_local - timedelta(days=7)
        else:  # 30d
            hours = 24 * 30
            points = 10  # Каждые 3 дня
            time_format = '%d.%m'
            start_time = now_local - timedelta(days=30)

        interval_hours = hours / points

        stats = []
        current_time = start_time

        for i in range(points):
            interval_start = current_time
            interval_end = current_time + timedelta(hours=interval_hours)

            # Конвертируем в UTC для запроса к базе данных
            interval_start_utc = interval_start.astimezone(
                timezone.utc) if interval_start.tzinfo else interval_start.replace(tzinfo=timezone.utc)
            interval_end_utc = interval_end.astimezone(timezone.utc) if interval_end.tzinfo else interval_end.replace(
                tzinfo=timezone.utc)

            # Получаем все проверки за этот интервал
            checks = WebsiteCheck.query.filter(
                WebsiteCheck.checked_at >= interval_start_utc,
                WebsiteCheck.checked_at < interval_end_utc
            ).all()

            if checks:
                up_checks = sum(1 for check in checks if check.is_up)
                uptime_percent = (up_checks / len(checks)) * 100 if checks else 0
            else:
                # Если нет данных за этот период, показываем 0
                uptime_percent = 0

            label = interval_start.strftime(time_format)

            stats.append({
                'label': label,
                'uptime': round(uptime_percent, 1)
            })

            current_time = interval_end

        return jsonify({
            'success': True,
            'data': stats,
            'period': period,
            'timezone': 'local'
        })

    except Exception as e:
        logger.error(f"Error in uptime stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'data': []
        })

@app.route('/api/real-status-stats')
def api_real_status_stats():
    """API для получения реальной статистики статусов из базы данных"""
    try:
        websites = Website.query.all()

        online_count = 0
        offline_count = 0
        active_count = 0
        paused_count = 0

        for website in websites:
            if website.is_active:
                active_count += 1
                # Получаем последнюю проверку
                last_check = WebsiteCheck.query.filter_by(website_id=website.id) \
                    .order_by(WebsiteCheck.checked_at.desc()) \
                    .first()

                if last_check and last_check.is_up:
                    online_count += 1
                elif last_check:
                    offline_count += 1
                else:
                    # Если нет проверок, считаем офлайн
                    offline_count += 1
            else:
                paused_count += 1

        return jsonify({
            'success': True,
            'data': {
                'online': online_count,
                'offline': offline_count,
                'active': active_count,
                'paused': paused_count
            }
        })

    except Exception as e:
        logger.error(f"Error in status stats: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/current-time')
def api_current_time():
    """API для получения текущего локального времени"""
    try:
        now_local = get_local_time()
        return jsonify({
            'success': True,
            'local_time': now_local.strftime('%Y-%m-%d %H:%M:%S'),
            'timezone': str(now_local.astimezone().tzinfo) if now_local.tzinfo else 'local'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/websites/export')
def export_websites():
    """Экспорт данных в CSV"""
    websites = Website.query.all()

    output = []
    output.append(['Название', 'URL', 'Статус', 'Последняя проверка', 'Код ответа', 'Время ответа'])

    for website in websites:
        last_check = WebsiteCheck.query.filter_by(website_id=website.id) \
            .order_by(WebsiteCheck.checked_at.desc()) \
            .first()

        # Конвертируем время в локальный часовой пояс
        if last_check:
            local_time = utc_to_local(last_check.checked_at)
            check_time_str = local_time.strftime('%Y-%m-%d %H:%M:%S')
        else:
            check_time_str = 'Нет данных'

        output.append([
            website.name,
            website.url,
            'Активен' if website.is_active else 'Приостановлен',
            check_time_str,
            last_check.status_code if last_check else 'N/A',
            f"{last_check.response_time:.2f}s" if last_check and last_check.response_time else 'N/A'
        ])

    # Создаем CSV
    si = StringIO()
    writer = csv.writer(si)
    writer.writerows(output)

    response = make_response(si.getvalue())
    response.headers['Content-Disposition'] = 'attachment; filename=websites_export.csv'
    response.headers['Content-type'] = 'text/csv'
    return response

@app.route('/api/health')
def api_health():
    """Health check endpoint"""
    try:
        website_count = Website.query.count()
        check_count = WebsiteCheck.query.count()
        # Получаем последние 10 проверок для отладки
        recent_checks = WebsiteCheck.query.order_by(WebsiteCheck.checked_at.desc()).limit(10).all()

        # Конвертируем время в локальный часовой пояс
        recent_checks_local = []
        for check in recent_checks:
            local_time = utc_to_local(check.checked_at)
            recent_checks_local.append({
                'website_id': check.website_id,
                'is_up': check.is_up,
                'checked_at': local_time.strftime('%Y-%m-%d %H:%M:%S'),
                'status_code': check.status_code
            })

        return jsonify({
            'status': 'healthy',
            'websites_count': website_count,
            'checks_count': check_count,
            'recent_checks': recent_checks_local,
            'timestamp': get_local_time().strftime('%Y-%m-%d %H:%M:%S'),
            'timezone': str(get_local_time().astimezone().tzinfo) if get_local_time().tzinfo else 'local'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

def init_database():
    """Initialize the database"""
    with app.app_context():
        db.create_all()
        logger.info("Database initialized")

def init_scheduler():
    """Initialize the scheduler"""
    with app.app_context():
        schedule_website_checks()
        logger.info("Scheduler initialized")

# Initialize the application
with app.app_context():
    init_database()
    init_scheduler()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)