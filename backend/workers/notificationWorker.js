import { notificationQueue } from '../services/queue.js';
import notifService from '../services/notificationService.js';

notificationQueue.process(async (job) => {
  const { provider, channel, to, message } = job.data;
  if(channel === 'sms'){
    return notifService.sendSMS({ provider, to, message });
  } else if(channel === 'whatsapp'){
    return notifService.sendWhatsApp({ provider, to, message });
  }
  throw new Error('Unknown channel');
});

notificationQueue.on('completed', (job, result) => {
  console.log('Notification sent', job.id, result);
});

notificationQueue.on('failed', (job, err) => {
  console.error('Notification failed', job.id, err);
});
