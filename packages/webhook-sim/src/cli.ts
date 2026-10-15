/**
 * CLI do simulador.
 *
 *   pnpm --filter @trafego/webhook-sim enviar --url http://localhost:3001 --empresa pasio \
 *     --fonte demo --segredo <s> [--lote 30] [--arquivo payloads.json] [--semente 42]
 *     [--invalido assinatura|timestamp|duplicado]
 *
 * O segredo também pode vir de `WEBHOOK_SIM_SEGREDO` (evita deixá-lo no histórico do shell).
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { enviar, gerarPayloads, montarEnvio, type ModoInvalido } from './index.js';

const MODOS: ModoInvalido[] = ['assinatura', 'timestamp', 'duplicado'];

async function principal(): Promise<number> {
  const { values: a } = parseArgs({
    options: {
      url: { type: 'string', default: 'http://localhost:3001' },
      empresa: { type: 'string', default: 'pasio' },
      fonte: { type: 'string', default: 'demo' },
      segredo: { type: 'string' },
      lote: { type: 'string', default: '30' },
      arquivo: { type: 'string' },
      semente: { type: 'string', default: '42' },
      invalido: { type: 'string' },
    },
    allowPositionals: true,
  });

  const segredo = a.segredo ?? process.env['WEBHOOK_SIM_SEGREDO'];
  if (!segredo) {
    console.error('Informe --segredo ou WEBHOOK_SIM_SEGREDO.');
    return 2;
  }
  const invalido = a.invalido as ModoInvalido | undefined;
  if (invalido && !MODOS.includes(invalido)) {
    console.error(`--invalido deve ser um de: ${MODOS.join(', ')}`);
    return 2;
  }

  // Arquivo é resolvido a partir de onde o comando foi chamado (pnpm muda o cwd para o pacote).
  const base = process.env['INIT_CWD'] ?? process.cwd();
  const payloads: unknown[] = a.arquivo
    ? (JSON.parse(await readFile(resolve(base, a.arquivo), 'utf8')) as unknown[])
    : gerarPayloads({ quantidade: Number(a.lote), semente: Number(a.semente) });
  if (!Array.isArray(payloads)) {
    console.error('--arquivo deve conter um array JSON de payloads.');
    return 2;
  }

  const contagem = new Map<number, number>();
  let falhou = false;
  for (const [i, payload] of payloads.entries()) {
    const envio = montarEnvio({
      url: a.url!,
      empresa: a.empresa!,
      fonte: a.fonte!,
      segredo,
      payload,
      ...(invalido && invalido !== 'duplicado' ? { invalido } : {}),
      ...(invalido === 'duplicado' ? { eventId: 'sim-duplicado-fixo' } : {}),
    });
    const vezes = invalido === 'duplicado' ? 2 : 1;
    for (let k = 0; k < vezes; k++) {
      try {
        const r = await enviar(envio);
        contagem.set(r.status, (contagem.get(r.status) ?? 0) + 1);
        console.log(`#${i + 1}${vezes > 1 ? `.${k + 1}` : ''} ${r.status} ${r.corpo}`);
      } catch (erro) {
        falhou = true;
        console.error(`#${i + 1} falha de rede: ${(erro as Error).message}`);
      }
    }
    if (invalido === 'duplicado') break;
  }
  console.log(
    'Resumo:',
    [...contagem].map(([s, n]) => `${s}×${n}`).join(', ') || 'nenhuma resposta',
  );
  return falhou ? 1 : 0;
}

process.exitCode = await principal();
