/**
 * Entry point
 *
 * @param {NS} ns
 */
export async function main(ns) {

    const header = [
        'target',
        'type',
        'host',
        'threads',
        'data',
        'start',
        'delay',
        'time',
        'finish',
        'estStart',
        'estDelay',
        'estTime',
        'estFinish',
    ]
    await ns.write('/data/port-stats.csv.txt', header.join(','), 'w')

    while (true) {
        while (ns.peek(1) !== 'NULL PORT DATA') {
            const payload = JSON.parse(ns.readPort(1))
            switch (payload.type) {
                case 'hack':
                case 'grow':
                case 'weaken':
                case 'check':
                    const row = [
                        payload.target,
                        payload.type,
                        payload.host,
                        payload.threads,
                        payload.data.amount ? payload.data.amount : JSON.stringify(payload.data),
                        payload.start,
                        payload.delay,
                        payload.time,
                        payload.finish,
                        payload.estStart,
                        payload.estDelay,
                        payload.estTime,
                        payload.estFinish,
                    ]
                    await ns.write('/data/port-stats.csv.txt', '\n' + row.join(','), 'a')
                    break;
            }
        }
        await ns.sleep(20)
    }

}
