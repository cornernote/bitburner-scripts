import {Runner} from "./lib/Runner.js"
import {settings} from "./_settings.js"

/**
 * Command options
 */
const argsSchema = [
    ['loop', false],
    ['help', false],
]

/**
 * Command auto-complete
 */
export function autocomplete(data, _) {
    data.flags(argsSchema)
    return []
}

/**
 * Entry method
 *
 * @param {NS} ns
 */
export async function main(ns) {
    const args = ns.flags(argsSchema)
    const runner = new Runner(ns)
    const upgradeHacknet = new UpgradeHacknet(ns, runner)
    // print help
    if (args.help) {
        ns.tprint(upgradeHacknet.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await upgradeHacknet.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

/**
 * UpgradeHacknet
 *
 * Manages and upgrades the hacknet servers.
 */
export class UpgradeHacknet {

    /**
     * The BitBurner instance
     * @type {NS}
     */
    ns

    /**
     * The Runner instance
     * @type {Runner}
     */
    runner

    /**
     * Player data
     * @type {Player}
     */
    player

    /**
     * Server data
     * @type {Server[]}
     */
    servers

    /**
     * Construct the class
     *
     * @param {NS} ns - the NS instance passed into the scripts main() entry method
     * @param {Runner} runner - the runner object
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, runner, config = {}) {
        this.ns = ns
        this.runner = runner
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value)
    }

    /**
     * The main job function.
     *
     * @returns {Promise<void>}
     */
    async doJob() {

    }

    /**
     * Loads the player information.
     *
     * @returns {Promise<*[]>}
     */
    async loadPlayer() {
        this.player = await this.runner.nsProxy['getPlayer']()
    }

    /**
     * Help text
     *
     * Player boss is stuck, let's get them some help.
     *
     * @returns {string}
     */
    getHelp() {
        return [
            '',
            '',
            'Manages and upgrades the hacknet servers.',
            '',
            `USAGE: run ${this.ns.getScriptName()}`,
            '',
            'Example:',
            `> run ${this.ns.getScriptName()}`,
            '',
            '',
        ].join("\n")
    }

}