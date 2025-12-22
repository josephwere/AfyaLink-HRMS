import cron from 'node-cron';
import { integrationDLQ, integrationQueue } from './integrationQueue.js';
import Audit from '../models/Audit.js';

// runs every 10 minutes to retry DLQ items with a 'retryable' flag or older than threshold
export function startDLQScheduler(){
  cron.schedule('*/10 * * * *', async ()=>{
    try{
      const jobs = await integrationDLQ.getJobs(['waiting','failed','delayed'], 0, 50);
      for(const job of jobs){
        try{
          // simple policy: retry items older than 30 minutes
          const age = Date.now() - job.timestamp;
          if(age > 30*60*1000){
            await integrationQueue.add(job.data);
            await job.remove();
            await Audit.create({ action:'dlq_auto_retry', details:{ jobId: job.id } });
            console.log('DLQ auto-retried job', job.id);
          }
        }catch(e){ console.error('DLQ auto-retry failed for job', job.id, e); }
      }
    }catch(err){ console.error('DLQ scheduler error', err); }
  });
}

export default { startDLQScheduler };
