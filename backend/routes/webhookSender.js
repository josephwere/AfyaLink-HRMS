import axios from 'axios';
import crypto from 'crypto';

export async function sendWebhook(connector, event, payload) {
  try{
    const signature = connector.webhookSecret ? crypto.createHmac('sha256', connector.webhookSecret).update(JSON.stringify(payload)).digest('hex') : null;
    await axios.post(connector.webhookUrl, { event, resource: payload }, { headers: { 'X-AFYA-SIGNATURE': signature } , timeout: 10000 });
    return true;
  }catch(e){
    console.error('sendWebhook error', e?.message || e);
    return false;
  }
}

export default { sendWebhook };
