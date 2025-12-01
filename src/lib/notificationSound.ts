// Notification sound for new messages
// This file will be used by the chat interface to play a sound when a new message arrives

export const playNotificationSound = () => {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Tv0IQsBS1+zPLTgjMGHm7A7OGZSg0PVKzl66FOEw1Emd3w0YAtBSpzy/DZhzQHJHC/6+CdTgsRWrHm6J9PHg0/mt/wxHEoBSl4yO7bhTEHIWy56uCaRg0NVKzl55tOEw0+mdz');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Could not play notification sound:', e));
    } catch (error) {
        console.error('Error playing notification sound:', error);
    }
};
