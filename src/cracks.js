import {getCracks} from "./lib/Server";

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

/**
 * Hacky way to run a terminal command
 *
 * @param message
 */
function terminalCommand(message) {
    const terminalInput = globalThis['document'].getElementById('terminal-input')
    if (terminalInput) {
        terminalInput.value = message
        const handler = Object.keys(terminalInput)[1]
        terminalInput[handler].onChange({target: terminalInput})
        terminalInput[handler].onKeyDown({keyCode: 13, preventDefault: () => null})
    }
}