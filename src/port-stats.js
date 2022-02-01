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
        'estStart',
        'estDelay',
        'estTime',
    ]
    await ns.write('/data/port-stats.csv.txt', header.join(',') + '\n', 'w')

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
                        payload.estStart,
                        payload.estDelay,
                        payload.estTime,
                    ]
                    await ns.write('/data/port-stats.csv.txt', row.join(',') + '\n', 'a')
                    break;
            }
        }
        await ns.sleep(20)
    }

}
