/* Updated: Organized app hierarchy, moved to src/ui folder, fixed imports and paths */
/**
 * Utility for displaying floating game notifications.
 */
export function showNotification(text, type='info') {
    const container = document.getElementById('notifications');
    const el = document.createElement('div');
    el.className = 'notification';
    
    // Icon mapping
    let icon = 'ℹ️';
    let title = 'System Update';
    let color = 'var(--color-primary)';

    if(type === 'alert') {
        icon = '⚠️';
        title = 'Alert';
        color = '#ff3333';
    } else if (type === 'success') {
        icon = '✅';
        title = 'Complete';
        color = '#33ff55';
    }

    el.innerHTML = `
        <span class="notification-title" style="color:${color}">${icon} ${title}</span>
        ${text}
    `;
    
    if(type !== 'info') el.style.borderLeftColor = color;

    container.appendChild(el);

    // Auto dismiss
    setTimeout(() => {
        el.style.transition = 'opacity 0.5s, transform 0.5s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        setTimeout(() => el.remove(), 500);
    }, 4000);
}