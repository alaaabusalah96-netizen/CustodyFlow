import { Notification } from '../types';
import { dbSetDoc } from '../firebase';
import { StorageEngine } from './storage';
import { DEFAULT_NOTIFICATIONS } from './defaults';

export class NotificationsModule {
  static getNotifications(): Notification[] {
    return StorageEngine.getStored<Notification[]>('Notifications', DEFAULT_NOTIFICATIONS);
  }

  static saveNotification(notification: Notification): void {
    const notifications = NotificationsModule.getNotifications();
    const index = notifications.findIndex(n => n.id === notification.id);
    if (index > -1) {
      notifications[index] = notification;
    } else {
      notifications.unshift(notification);
    }
    StorageEngine.setStored('Notifications', notifications);
    dbSetDoc('Notifications', notification.id, notification);
  }

  static markNotificationAsRead(id: string): void {
    const notifications = NotificationsModule.getNotifications();
    const notification = notifications.find(n => n.id === id);
    if (notification) {
      notification.is_read = true;
      NotificationsModule.saveNotification(notification);
    }
  }
}
