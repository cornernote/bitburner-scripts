/**
 * Entry method
 *
 * @param {NS} ns
 */
import {formatDelay} from "./lib/Helpers";

export async function main(ns) {

    let hackPercent = 0.8
    let target = ns.getServer('omega-net')
    ns.tprint(`target.moneyAvailable is ${ns.nFormat(target.moneyAvailable, '$0.000a')} / ${ns.nFormat(target.moneyMax, '$0.000a')}`)
    ns.tprint(`target.hackDifficulty is ${target.hackDifficulty} / ${target.minDifficulty}`)

    let Hchange = 0.002
    let Gchange = 0.004 // ns.growthAnalyzeSecurity(1)
    let Wchange = 0.05 // ns.weakenAnalyze(1)

    let HTime = ns.getHackTime(target.hostname)
    let GTime = ns.getGrowTime(target.hostname)
    let WTime = ns.getWeakenTime(target.hostname)

    if (target.hackDifficulty > target.minDifficulty + 1) {
        let Wthreads = Math.ceil((target.hackDifficulty - target.minDifficulty) / Wchange)
        ns.tprint(`W=${Wthreads} time=${formatDelay(WTime)}`)
        ns.exec('/hacks/weaken.js', 'home', Wthreads, target.hostname)
        return
    }

    if (target.moneyAvailable < target.moneyMax * 0.9) {
        let Gthreads = Math.ceil(ns.growthAnalyze(target.hostname, target.moneyMax / target.moneyAvailable))
        let Wthreads = Math.ceil((Gthreads * Gchange) / Wchange)
        ns.tprint(`G=${Gthreads}|W=${Wthreads} time=${formatDelay(WTime)}`)
        ns.exec('/hacks/grow.js', 'home', Gthreads, target.hostname)
        ns.exec('/hacks/weaken.js', 'home', Wthreads, target.hostname)
        return
    }

    let hackAnalyze = ns.hackAnalyze(target.hostname) // percent of money stolen with a single thread


    let Hthreads = Math.floor(ns.hackAnalyzeThreads(target.hostname, target.moneyAvailable * hackPercent))
    let HWthreads = Math.ceil((Hthreads * Hchange) / Wchange)

    let hackedPercent = Hthreads * hackAnalyze
    let growthRequired = 1 / (1 - hackedPercent)
    // let growthRequired = 1 / (1 - hackPercent)

    let Gthreads = Math.ceil(ns.growthAnalyze(target.hostname, growthRequired))
    // let Gthreads = Math.ceil(ns.growthAnalyze(target.hostname, 1 / (1 - hackPercent)))
    let GWthreads = Math.ceil((Gthreads * Gchange) / Wchange)

    for (let i = 0; i < 10; i++) {
        const uuid = `test-${i}`
        const delay = 1000 * i
        ns.tprint(`H=${Hthreads}|HW=${HWthreads}|G=${Gthreads}|GW=${GWthreads} time=${formatDelay(WTime + 500)}`)
        ns.exec('/hacks/hack.js', 'home', Hthreads, target.hostname, delay + WTime - HTime, uuid, false, true, false)
        ns.exec('/hacks/weaken.js', 'home', HWthreads, target.hostname, delay + 100, uuid, false, true, false)
        ns.exec('/hacks/grow.js', 'home', Gthreads, target.hostname, delay + WTime - GTime + 200, uuid, false, true, false)
        ns.exec('/hacks/weaken.js', 'home', GWthreads, target.hostname, delay + 300, uuid, false, true, false)
        ns.exec('/hacks/check.js', 'home', GWthreads, target.hostname, delay + WTime + 400, uuid, false, true, false)
    }
    //
    // await ns.sleep(WTime + 500)
    //
    // target = ns.getServer('omega-net')
    // ns.tprint(`target.moneyAvailable is ${ns.nFormat(target.moneyAvailable, '$0.000a')} / ${ns.nFormat(target.moneyMax, '$0.000a')}`)
    // ns.tprint(`target.hackDifficulty is ${target.hackDifficulty} / ${target.minDifficulty}`)

}
