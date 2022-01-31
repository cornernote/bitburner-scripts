/**
 * Entry method
 *
 * @param {NS} ns
 */
export async function main(ns) {

    let target = ns.getServer('foodnstuff')
    ns.tprint(`target.moneyAvailable is ${ns.nFormat(target.moneyAvailable, '$0.000a')} / ${ns.nFormat(target.moneyMax, '$0.000a')}`)
    ns.tprint(`target.hackDifficulty is ${target.hackDifficulty} / ${target.minDifficulty}`)

    let Hchange = 0.002
    let Gchange = 0.004 // ns.growthAnalyzeSecurity(1)
    let Wchange = 0.05 // ns.weakenAnalyze(1)


    if (target.hackDifficulty > target.minDifficulty + 1) {
        let Wthreads = Math.ceil((target.hackDifficulty - target.minDifficulty) / Wchange)
        ns.tprint(`W=${Wthreads}`)
        ns.exec('/hacks/weaken.js', 'home', Wthreads, target.hostname)
        return
    }

    if (target.moneyAvailable < target.moneyMax * 0.9) {
        let Gthreads = Math.ceil(ns.growthAnalyze(target.hostname, target.moneyMax / target.moneyAvailable))
        let Wthreads = Math.ceil((Gthreads * Gchange) / Wchange)
        ns.tprint(`G=${Gthreads}|W=${Wthreads}`)
        ns.exec('/hacks/grow.js', 'home', Gthreads, target.hostname)
        ns.exec('/hacks/weaken.js', 'home', Wthreads, target.hostname)
        return
    }


    let Hthreads = Math.ceil(ns.hackAnalyzeThreads(target.hostname, target.moneyAvailable * 0.2))
    //let Gthreads = Math.ceil(ns.growthAnalyze(target.hostname, 1 / (1 - ns.hackAnalyze(target.hostname) * Hthreads)))
    let Gthreads = Math.ceil(ns.growthAnalyze(target.hostname, 1 / (1 - 0.2)))
    let Wthreads = Math.ceil((Hthreads * Hchange) / Wchange) + Math.ceil((Gthreads * Gchange) / Wchange)

    ns.tprint(`H=${Hthreads}|G=${Gthreads}|W=${Wthreads}`)
    ns.exec('/hacks/hack.js', 'home', Hthreads, target.hostname)
    ns.exec('/hacks/grow.js', 'home', Gthreads, target.hostname)
    ns.exec('/hacks/weaken.js', 'home', Wthreads, target.hostname)

}
