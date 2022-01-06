import {Runner} from "/lib/Runner"

/**
 * Sample script
 * Gets player information using a background task
 *
 * Get the response from `ns.getPlayer()`, however avoids the 0.5GB RAM cost
 *
 * In this case
 * - there is a 1.1GB RAM cost for the background process which is not worth the tradeoff for the 0.5GB saving to `ns.getPlayer()`
 * - there is also a background task that will consume the 0.5GB (+1.6GB base script), however it will quickly end
 * - the tradeoff is worthwhile when you run this multiple times, across multiple NS calls that cost RAM
 * - the total cost will always be FLAT 1.1GB for this script, plus whatever RAM the background script costs.
 *
 * @RAM 2.7GB/thread = 1.1GB (+1.6GB for base script)
 * @param {NS} ns
 */
export async function main(ns) {
    const runner = new Runner(ns)
    //let player = await runner.nsProxy.getPlayer() // works, but game still takes the RAM
    let player = await runner.nsProxy['getPlayer']()
    ns.tprint(player)
}
