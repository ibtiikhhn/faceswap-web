import {afterEach,expect,it,vi} from 'vitest';
import {startPollLoop} from '@/worker/poll-loop';
afterEach(()=>vi.useRealTimers());
it('a blocked swap lane does not block billing, and shutdown drains it',async()=>{
 vi.useFakeTimers();
 let release!:()=>void;
 const swap=vi.fn(()=>new Promise<void>(resolve=>{release=resolve;}));
 const billing=vi.fn(async()=>{});
 const error=vi.fn();
 const stopSwap=startPollLoop(swap,3000,error),stopBilling=startPollLoop(billing,3000,error);
 await vi.advanceTimersByTimeAsync(9000);
 expect(swap).toHaveBeenCalledTimes(1);expect(billing).toHaveBeenCalledTimes(4);
 let drained=false;const stopped=stopSwap().then(()=>{drained=true;});
 await Promise.resolve();expect(drained).toBe(false);
 release();await stopped;await stopBilling();
 await vi.advanceTimersByTimeAsync(9000);expect(billing).toHaveBeenCalledTimes(4);
});
it('recovers from startup failure without overlapping attempts',async()=>{
 vi.useFakeTimers();
 const task=vi.fn().mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValue(undefined);
 const error=vi.fn();const stop=startPollLoop(task,3000,error);
 await vi.advanceTimersByTimeAsync(3000);
 expect(error).toHaveBeenCalledTimes(1);expect(task).toHaveBeenCalledTimes(2);
 await stop();
});

it('uses slow idle checks and resumes fast polling after work',async()=>{
 vi.useFakeTimers();
 const task=vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValue(false);
 const stop=startPollLoop(task,3000,vi.fn(),{idleMs:30000});
 await vi.advanceTimersByTimeAsync(29999);expect(task).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1);expect(task).toHaveBeenCalledTimes(2);
 await vi.advanceTimersByTimeAsync(3000);expect(task).toHaveBeenCalledTimes(3);
 await stop();
});
it('backs off database failures instead of retrying at the busy rate',async()=>{
 vi.useFakeTimers();const error=vi.fn();const task=vi.fn().mockRejectedValue(new Error('offline'));
 const stop=startPollLoop(task,3000,error,{idleMs:30000});
 await vi.advanceTimersByTimeAsync(29999);expect(task).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1);expect(task).toHaveBeenCalledTimes(2);await stop();
});
