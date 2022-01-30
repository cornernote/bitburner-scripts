import {getCracks} from "./lib/Server";
import {terminalCommand} from "./lib/Helpers";

/**
 * Entry point
 *
 * @param {NS} ns
 */
export async function main(ns) {
    // get some stuff ready
    ns.disableLog('ALL')
    const player = ns.getPlayer()

    // recommend the player buy the tor router
    if (!player.tor && player.money > 200000) {
        ns.tprint('WARNING: Missing Tor Router - You should buy the TOR Router at City > alpha ent.')
    }

    // buy unowned cracks
    if (player.tor) {
        const unownedCracks = getCracks(ns).filter(c => c.cost <= player.money && !c.owned)
        if (unownedCracks.length) {
            ns.tprint(`Buying: ${unownedCracks.map(c => c.file).join(', ')}.`)
            terminalCommand([
                'connect darkweb',
                unownedCracks.map(c => `buy ${c.file}`).join(';'),
                'home',
            ].join(';'))
        }
    }

}
