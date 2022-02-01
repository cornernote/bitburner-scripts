/**
 * Entry point
 *
 * @param {NS} ns
 */
export async function main(ns) {

    const stats = {}
    while (ns.peek(1) !== 'NULL PORT DATA') {
        const data = JSON.parse(ns.readPort(1))
        switch (data.action) {
            case 'hack':
            case 'grow':
            case 'weaken':
                if (!stats[data.target]) {
                    stats[data.target] = []
                }
                stats[data.target].push(data)
                break;
        }
        await ns.write('/data/stats.json.txt', JSON.stringify(stats))
    }

}
