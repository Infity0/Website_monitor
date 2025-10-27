// SiteMonitor Pro - Main JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    console.log('Initializing SiteMonitor...');
    initSidebar();
    initAlerts();
    initAnimations();
    initCurrentTime();
    fixFormElements();
    fixFormInputs();
    initCharts();
    initWebsiteActions();
}

// Sidebar functionality
function initSidebar() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const mainContent = document.getElementById('mainContent');

    if (!sidebarToggle || !sidebar) return;

    sidebarToggle.addEventListener('click', function() {
        const isCollapsing = !sidebar.classList.contains('collapsed');

        sidebar.classList.toggle('collapsed');

        // Handle mobile overlay
        if (window.innerWidth <= 768) {
            if (isCollapsing) {
                sidebar.classList.add('mobile-open');
                if (mobileOverlay) {
                    mobileOverlay.classList.add('show');
                }
            } else {
                sidebar.classList.remove('mobile-open');
                if (mobileOverlay) {
                    mobileOverlay.classList.remove('show');
                }
            }
        }
    });

    // Close sidebar on mobile when clicking overlay
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', function() {
            sidebar.classList.remove('collapsed');
            sidebar.classList.remove('mobile-open');
            this.classList.remove('show');
        });
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('mobile-open');
            if (mobileOverlay) {
                mobileOverlay.classList.remove('show');
            }
        }
    });
}

// Alerts and notifications
function initAlerts() {
    const alerts = document.querySelectorAll('.alert-toast');

    alerts.forEach(alert => {
        setupAlertClose(alert);
        autoDismissAlert(alert, 5000);
    });
}

function setupAlertClose(alert) {
    const closeBtn = alert.querySelector('.alert-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            dismissAlert(alert);
        });
    }
}

function autoDismissAlert(alert, duration) {
    setTimeout(() => {
        dismissAlert(alert);
    }, duration);
}

function dismissAlert(alert) {
    alert.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 300);
}

// Animations
function initAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                entry.target.style.transition = 'all 0.6s ease';
            }
        });
    }, observerOptions);

    // Observe all cards and stat items
    document.querySelectorAll('.card, .stat-card, .website-card').forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'all 0.6s ease';
        observer.observe(element);
    });
}

// Current time display
function initCurrentTime() {
    const timeElement = document.getElementById('currentTime');
    if (!timeElement) return;

    function updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        timeElement.textContent = timeString;
    }

    updateTime();
    setInterval(updateTime, 1000);
}

// Form elements fix
function fixFormElements() {
    // Fix select elements
    document.querySelectorAll('select').forEach(select => {
        if (!select.classList.contains('form-select')) {
            select.classList.add('form-select');
        }
    });

    // Fix form controls
    document.querySelectorAll('.form-control').forEach(input => {
        if (input.type === 'select') {
            input.classList.add('form-select');
        }
    });
}

// Fix form inputs in add site page
function fixFormInputs() {
    const formInputs = document.querySelectorAll('.site-form input, .site-form select');

    formInputs.forEach(input => {
        // Устанавливаем правильные стили
        input.style.backgroundColor = '#252641';
        input.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        input.style.color = '#ffffff';

        // Обработчик для фокуса
        input.addEventListener('focus', function() {
            this.style.backgroundColor = '#252641';
            this.style.borderColor = '#6366f1';
            this.style.color = '#ffffff';
        });

        // Обработчик для потери фокуса
        input.addEventListener('blur', function() {
            this.style.backgroundColor = '#252641';
            this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            this.style.color = '#ffffff';
        });
    });
}

// Chart functionality
function initCharts() {
    console.log('Initializing charts with REAL data...');

    // Add chart styles
    addChartStyles();

    // Initialize charts if they exist on the page
    const uptimeChart = document.getElementById('uptimeChart');
    const statusChart = document.getElementById('statusChart');

    if (uptimeChart || statusChart) {
        initUptimeChart();
        initStatusChart();
        initChartControls();

        // Автоматически загружаем данные для активной кнопки
        const activeButton = document.querySelector('.chart-controls button.active');
        if (activeButton) {
            const period = activeButton.dataset.period;
            console.log('Initial load for period:', period);
            loadChartData(period);
        } else {
            // Если нет активной кнопки, загружаем данные по умолчанию
            loadChartData('24h');
        }

        // Start auto-refresh
        setTimeout(startChartAutoRefresh, 1000);
    }
}

// Uptime chart
function initUptimeChart() {
    const ctx = document.getElementById('uptimeChart');
    if (!ctx) {
        console.log('Uptime chart canvas not found');
        return;
    }

    // Destroy existing chart if it exists
    if (window.uptimeChart instanceof Chart) {
        window.uptimeChart.destroy();
    }

    console.log('Creating uptime chart...');
    window.uptimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Аптайм %',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 15, 35, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `Аптайм: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });

    console.log('Uptime chart created successfully');
}

// Status chart
function initStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) {
        console.log('Status chart canvas not found');
        return;
    }

    // Destroy existing chart if it exists
    if (window.statusChart instanceof Chart) {
        window.statusChart.destroy();
    }

    console.log('Creating status chart...');
    window.statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Online', 'Offline', 'Активные', 'Приостановлены'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: [
                    '#10b981',
                    '#ef4444',
                    '#6366f1',
                    '#6b7280'
                ],
                borderColor: 'rgba(30, 31, 55, 0.8)',
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 15, 35, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            return `${label}: ${value}`;
                        }
                    }
                }
            }
        }
    });
}

// Chart controls
function initChartControls() {
    const periodButtons = document.querySelectorAll('.chart-controls button');
    console.log('Found chart control buttons:', periodButtons.length);

    periodButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            periodButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-outline');
            });

            // Add active class to clicked button
            this.classList.add('active');
            this.classList.remove('btn-outline');
            this.classList.add('btn-primary');

            const period = this.dataset.period;
            console.log('Changing period to:', period);

            // Принудительно перезагружаем данные БЕЗ уведомлений
            loadChartData(period, false);
        });
    });
}

// Load chart data
function loadChartData(period = '24h', showNotifications = false) {
    console.log('Loading REAL chart data for period:', period);
    loadUptimeData(period, showNotifications);
    loadStatusData(showNotifications);
}

// Load uptime data - ТОЛЬКО РЕАЛЬНЫЕ ДАННЫЕ
function loadUptimeData(period, showNotifications = false) {
    console.log('Fetching REAL uptime data for period:', period);

    // Show loading state
    const chartContainer = document.querySelector('#uptimeChart')?.closest('.card');
    if (chartContainer) {
        chartContainer.classList.add('loading');
    }

    fetch(`/api/uptime-stats?period=${period}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('REAL uptime data received:', data);

            if (data.success && window.uptimeChart) {
                if (data.data && data.data.length > 0) {
                    const labels = data.data.map(item => item.label);
                    const uptimeData = data.data.map(item => item.uptime);

                    // Полностью обновляем данные графика
                    window.uptimeChart.data.labels = labels;
                    window.uptimeChart.data.datasets[0].data = uptimeData;

                    // Принудительно обновляем график
                    window.uptimeChart.update();

                    console.log('Uptime chart updated with REAL data:', uptimeData.length, 'data points for period:', period);
                    console.log('Labels:', labels);
                    console.log('Data:', uptimeData);

                    // Показываем уведомление только если явно запрошено
                    if (showNotifications) {
                        showNotification(`Загружены реальные данные за ${period}`, 'success');
                    }
                } else {
                    console.warn('No real data available for period:', period);
                    // Показываем уведомление только если явно запрошено
                    if (showNotifications) {
                        showNotification('Нет данных для отображения за выбранный период', 'warning');
                    }

                    // Очищаем график если нет данных
                    window.uptimeChart.data.labels = [];
                    window.uptimeChart.data.datasets[0].data = [];
                    window.uptimeChart.update();
                }
            } else {
                console.error('Uptime data error:', data);
                // Показываем уведомление только если явно запрошено
                if (showNotifications) {
                    showNotification('Ошибка загрузки реальных данных аптайма', 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error loading REAL uptime data:', error);
            // Показываем уведомление только если явно запрошено
            if (showNotifications) {
                showNotification('Ошибка загрузки реальных данных: ' + error.message, 'error');
            }
        })
        .finally(() => {
            // Remove loading state
            if (chartContainer) {
                chartContainer.classList.remove('loading');
            }
        });
}

// Load status data - ТОЛЬКО РЕАЛЬНЫЕ ДАННЫЕ
function loadStatusData(showNotifications = false) {
    console.log('Fetching REAL status data...');

    fetch('/api/real-status-stats')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('REAL status data received:', data);
            if (data.success && window.statusChart) {
                const statusData = [
                    data.data.online || 0,
                    data.data.offline || 0,
                    data.data.active || 0,
                    data.data.paused || 0
                ];

                window.statusChart.data.datasets[0].data = statusData;
                window.statusChart.update();

                console.log('Status chart updated with REAL data:', statusData);
            } else {
                console.error('Status data error:', data.error);
                // Показываем уведомление только если явно запрошено
                if (showNotifications) {
                    showNotification('Ошибка загрузки реальной статистики статусов', 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error loading REAL status data:', error);
            // Показываем уведомление только если явно запрошено
            if (showNotifications) {
                showNotification('Ошибка загрузки реальной статистики статусов: ' + error.message, 'error');
            }
        });
}

// Auto-refresh charts
function startChartAutoRefresh() {
    console.log('Starting chart auto-refresh with REAL data...');
    setInterval(() => {
        if (document.getElementById('uptimeChart')) {
            const activePeriod = document.querySelector('.chart-controls button.active')?.dataset.period || '24h';
            console.log('Auto-refreshing charts with REAL data for period:', activePeriod);
            // Авто-обновление без уведомлений
            loadChartData(activePeriod, false);
        }
    }, 30000); // Refresh every 30 seconds
}

// Add chart styles to CSS
function addChartStyles() {
    if (!document.querySelector('#chart-styles')) {
        const styles = document.createElement('style');
        styles.id = 'chart-styles';
        styles.textContent = `
            .chart-container {
                position: relative;
                height: 300px;
                width: 100%;
            }

            .chart-controls {
                display: flex;
                gap: 0.5rem;
            }

            .chart-controls .btn {
                padding: 0.5rem 1rem;
                font-size: 0.8rem;
                border: 1px solid var(--border-color);
                color: var(--text-secondary);
                background: transparent;
                transition: all 0.3s ease;
            }

            .chart-controls .btn:hover,
            .chart-controls .btn.active {
                background: var(--primary);
                border-color: var(--primary);
                color: white;
            }

            .card.loading {
                position: relative;
                overflow: hidden;
            }

            .card.loading::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.1), transparent);
                animation: loading 1.5s infinite;
            }

            @keyframes loading {
                0% { left: -100%; }
                100% { left: 100%; }
            }

            @keyframes slideOut {
                from {
                    opacity: 1;
                    transform: translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateY(-10px);
                }
            }

            .mobile-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 999;
                display: none;
            }

            .mobile-overlay.show {
                display: block;
            }

            @media (max-width: 768px) {
                .chart-container {
                    height: 250px;
                }

                .chart-controls {
                    justify-content: center;
                    flex-wrap: wrap;
                }

                .chart-controls .btn {
                    flex: 1;
                    min-width: 60px;
                    text-align: center;
                }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Website actions - ИСПРАВЛЕННЫЕ ОБРАБОТЧИКИ
function initWebsiteActions() {
    // Удаляем все существующие обработчики перед добавлением новых
    document.querySelectorAll('.btn-toggle').forEach(button => {
        button.replaceWith(button.cloneNode(true));
    });
    document.querySelectorAll('.btn-check').forEach(button => {
        button.replaceWith(button.cloneNode(true));
    });
    document.querySelectorAll('.btn-delete').forEach(button => {
        button.replaceWith(button.cloneNode(true));
    });

    // Toggle website monitoring
    document.querySelectorAll('.btn-toggle').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const websiteId = this.dataset.websiteId;
            toggleWebsiteMonitoring(websiteId, this);
        });
    });

    // Check website now
    document.querySelectorAll('.btn-check').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const websiteId = this.dataset.websiteId;
            checkWebsiteNow(websiteId, this);
        });
    });

    // Delete website
    document.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const websiteId = this.dataset.websiteId;
            const websiteName = this.dataset.websiteName;
            deleteWebsite(websiteId, websiteName);
        });
    });
}

async function toggleWebsiteMonitoring(websiteId, button) {
    try {
        const response = await fetch(`/websites/${websiteId}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            showNotification('Статус мониторинга изменен', 'success');
            // Используем setTimeout для предотвращения множественных перезагрузок
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            throw new Error('Failed to toggle monitoring');
        }
    } catch (error) {
        console.error('Error toggling website monitoring:', error);
        showNotification('Ошибка при изменении статуса', 'error');
    }
}

async function checkWebsiteNow(websiteId, button) {
    const originalHTML = button.innerHTML;

    try {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;

        const response = await fetch(`/websites/${websiteId}/check-now`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            showNotification('Проверка сайта выполнена', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            throw new Error(data.message || 'Failed to check website');
        }
    } catch (error) {
        console.error('Error checking website:', error);
        showNotification('Ошибка при проверке сайта: ' + error.message, 'error');
        button.innerHTML = originalHTML;
        button.disabled = false;
    }
}

async function deleteWebsite(websiteId, websiteName) {
    if (confirm(`Вы уверены, что хотите удалить сайт "${websiteName}"? Все данные проверок будут удалены.`)) {
        try {
            const response = await fetch(`/websites/${websiteId}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                showNotification('Сайт успешно удален', 'success');
                // Используем setTimeout вместо немедленного reload
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                throw new Error('Failed to delete website');
            }
        } catch (error) {
            console.error('Error deleting website:', error);
            showNotification('Ошибка при удалении сайта', 'error');
        }
    }
}

// Global notification function
window.showNotification = function(message, type = 'info', duration = 5000) {
    const alertClass = {
        'error': 'danger',
        'success': 'success',
        'info': 'info',
        'warning': 'warning'
    }[type] || 'info';

    const iconClass = {
        'error': 'exclamation-triangle',
        'success': 'check-circle',
        'info': 'info-circle',
        'warning': 'exclamation-circle'
    }[type] || 'info-circle';

    const alertToast = document.createElement('div');
    alertToast.className = `alert-toast show`;
    alertToast.innerHTML = `
        <div class="alert-icon ${alertClass}">
            <i class="fas fa-${iconClass}"></i>
        </div>
        <div class="alert-content">
            <div class="alert-title">Уведомление</div>
            <div class="alert-message">${message}</div>
        </div>
        <button class="alert-close">
            <i class="fas fa-times"></i>
        </button>
    `;

    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
        contentArea.insertBefore(alertToast, contentArea.firstChild);
        setupAlertClose(alertToast);
        autoDismissAlert(alertToast, duration);
    }
};

// Utility function for making API calls
window.apiCall = async function(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
};

// Debug function to check database data
window.debugData = function() {
    fetch('/api/health')
        .then(response => response.json())
        .then(data => {
            console.log('Database debug info:', data);
            showNotification('Данные отладки загружены в консоль', 'info');
        })
        .catch(error => {
            console.error('Debug error:', error);
        });
};

// Initialize when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Export functions for global access
window.SiteMonitor = {
    showNotification,
    apiCall,
    initCharts,
    loadChartData,
    debugData
};