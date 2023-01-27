/**
 * Remote: Growth Analyze
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog('ALL')

    const args = ns.flags([])
    const port = args['_'][0] || 1
    const hostname = args['_'][1]
    const cores = args['_'][2] || 1

    const growthAnalyze = ns.growthAnalyze(hostname, cores)

    ns.writePort(port, JSON.stringify(growthAnalyze))
}