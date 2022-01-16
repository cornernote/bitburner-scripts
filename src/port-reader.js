import {Runner} from "./lib/Runner.js"
import {settings} from "./_settings.js"

/**
 * Command options
 */
const argsSchema = [
    ['loop', false],
    ['proxy', false],
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
    let nsProxy = runner.nsProxy
    if (!args['proxy']) {
        nsProxy = ns
    }
    // load job module
    const portReader = new PortReader(ns, nsProxy)
    // print help
    if (args.help) {
        ns.tprint(portReader.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await portReader.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    // comment if using nsProxy
    ns.fileExists()
}

/**
 * PortReader
 *
 * Reads port data for stats.
 */
export class PortReader {

    /**
     * The BitBurner instance
     * @type {NS}
     */
    ns

    /**
     * The nsProxy instance
     * @type {NS}
     */
    nsProxy

    /**
     * The time we last ran
     * @type {Number}
     */
    lastRun

    /**
     * Construct the class
     *
     * @param {NS} ns - the NS instance passed into the scripts main() entry method
     * @param {NS} nsProxy - the nsProxy object
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, nsProxy, config = {}) {
        this.ns = ns
        this.nsProxy = nsProxy
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value)
    }

    /**
     * The main job function.
     *
     * @returns {Promise<void>}
     */
    async doJob() {
        // check if we need to run
        if (this.lastRun + settings.intervals['port-reader'] > new Date().getTime()) {
            return
        }
        // run
        //this.ns.tprint('PortReader...')
        await this.portReader()
        // set the last run time
        this.lastRun = new Date().getTime()
    }

    /**
     * Reads port data for stats.
     *
     * @returns {Promise<void>}
     */
    async portReader() {
        const stats = this.nsProxy['fileExists']('/data/stats.json.txt')
            ? JSON.parse(await this.ns.read('/data/stats.json.txt'))
            : {}
        while (this.ns.peek(1) !== 'NULL PORT DATA') {
            const data = JSON.parse(this.ns.readPort(1))

            switch (data.action) {

                case 'hack':
                    if (!stats[data.target]) {
                        stats[data.target] = {
                            target: data.target,
                            total: 0,
                            attempts: 0,
                            average: 0,
                            success: 0,
                            consecutiveFailures: 0,
                        }
                    }
                    if (data.amount > 0) {
                        stats[data.target].total += data.amount
                        stats[data.target].success++
                        stats[data.target].consecutiveFailures = 0
                    } else {
                        stats[data.target].consecutiveFailures++
                    }
                    stats[data.target].attempts++
                    stats[data.target].average = stats[data.target].total / stats[data.target].attempts
                    break;

                case 'start':
                case 'restart':
                    stats[data.target] = {
                        target: data.target,
                        total: 0,
                        attempts: 0,
                        average: 0,
                        success: 0,
                        consecutiveFailures: 0,
                    }
                    break;
            }

        }
        await this.ns.write('/data/stats.json', JSON.stringify(stats), 'w')
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
            'Reads port data for stats.',
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
