import { VoipClient, CallState, type OutgoingCallOptions, type VoipDiagnostic, type WASocket } from '../lib/index.js';
declare const sock: WASocket;
const opts: OutgoingCallOptions = { audioSource: '/tmp/authorized.ogg', durationMs: 60_000, connectTimeoutMs: 30_000, endOnAudioEnd: true };
const client = new VoipClient({ onDiagnostic: (event: VoipDiagnostic) => { const code: string = event.code; void code; } });
async function example() {
  await client.connectWithSocket(sock);
  const call = await client.call('6280000000000', opts);
  call.on('connected', () => { const state: number = call.state; void state; });
  call.on('audio', (pcm) => { const n: number = pcm[0]; void n; });
  call.on('ended', (reason) => { const why: string = reason; void why; });
  const result: string = await call.waitForEnd();
  const active: boolean = client.getStats().callActive;
  if (call.state === CallState.Active) call.mute(true);
  call.end(); client.disconnect(); void result; void active;
}
void example;
