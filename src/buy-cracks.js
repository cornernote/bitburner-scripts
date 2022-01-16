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
    // load job module
    const buyCracks = new BuyCracks(ns, runner.nsProxy)
    // print help
    if (args.help) {
        ns.tprint(buyCracks.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await buyCracks.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    ns.run()
    ns.isRunning(0)
}

/**
 * BuyCracks
 *
 * Buys cracks from the darkweb.
 */
export class BuyCracks {

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
     * Player data
     * @type {Player}
     */
    player

    /**
     * The time we last ran
     * @type {Number}
     */
    lastRun

    /**
     * List of port hacks that are used to root servers
     * @type {Array}
     */
    cracks

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
        if (this.lastRun + settings.intervals['buy-cracks'] > new Date().getTime()) {
            return
        }
        // run
        this.ns.tprint('BuyCracks...')
        await this.buyCracks()
        // set the last run time
        this.lastRun = new Date().getTime()
    }


    /**
     * Gain root access on any available servers.
     *
     * @returns {Promise<void>}
     */
    async buyCracks() {
        // refresh data
        await this.loadPlayer()
        await this.loadCracks()

        // recommend the player buy the tor router
        if (!this.player.tor && this.player.money > 200000) {
            this.ns.tprint("\n\n\n" + [
                '============================',
                `|| 🖥 Tor Router Required ||`,
                '============================',
                '',
                `You should buy the TOR Router at City > alpha ent.`
            ].join("\n") + "\n\n\n")
        }

        // buy unowned cracks
        if (this.player.tor) {
            const unownedCracks = this.cracks.filter(c => c.cost && !c.owned)
            for (const crack of unownedCracks) {
                if (this.player.money > crack.cost) {
                    this.ns.tprint("\n\n\n" + [
                        '=====================',
                        `|| 🖥 Buying Crack ||`,
                        '=====================',
                        '',
                        `About to purchase ${crack.exe}...`
                    ].join("\n") + "\n\n\n")
                    await this.terminalCommand('connect darkweb')
                    await this.terminalCommand(`buy ${crack.exe}`)
                    await this.terminalCommand('home')
                    await this.loadPlayer()
                }
            }
        }

    }


    /**
     * Loads the player information.
     *
     * @returns {Promise<*[]>}
     */
    async loadPlayer() {
        this.player = await this.nsProxy['getPlayer']()
    }

    /**
     * Loads a list of cracks.
     *
     * @returns {Promise<*[]>}
     */
    async loadCracks() {
        this.cracks = [
            {
                method: 'nuke',
                exe: 'NUKE.exe',
                cost: 0,
                type: 'tool',
            },
            {
                method: 'brutessh',
                exe: 'BruteSSH.exe',
                cost: 500000,
                type: 'port',
            },
            {
                method: 'ftpcrack',
                exe: 'FTPCrack.exe',
                cost: 1500000,
                type: 'port',
            },
            {
                method: 'relaysmtp',
                exe: 'relaySMTP.exe',
                cost: 5000000,
                type: 'port',
            },
            {
                method: 'httpworm',
                exe: 'HTTPWorm.exe',
                cost: 30000000,
                type: 'port',
            },
            {
                method: 'sqlinject',
                exe: 'SQLInject.exe',
                cost: 250000000,
                type: 'port',
            },

            {
                exe: 'ServerProfiler.exe',
                cost: 500000,
                type: 'tool',
            },
            {
                exe: 'DeepscanV1.exe',
                cost: 500000,
                type: 'tool',
            },
            {
                exe: 'DeepscanV2.exe',
                cost: 25000000,
                type: 'tool',
            },
            {
                exe: 'AutoLink.exe',
                cost: 1000000,
                type: 'tool',
            },
            {
                exe: 'Formulas.exe',
                cost: 5000000000,
                type: 'tool',
            },
        ]
        for (const crack of this.cracks) {
            crack.owned = await this.nsProxy['fileExists'](crack.exe, 'home')
        }
    }

    /**
     * Hacky way to run a terminal command
     *
     * @param message
     * @param delay
     * @returns {Promise<void>}
     */
    async terminalCommand(message, delay = 500) {
        const docs = globalThis['document']
        const terminalInput = /** @type {HTMLInputElement} */ (docs.getElementById("terminal-input"))
        terminalInput.value = message
        const handler = Object.keys(terminalInput)[1]
        terminalInput[handler].onChange({target: terminalInput})
        terminalInput[handler].onKeyDown({keyCode: 13, preventDefault: () => null})
        await this.ns.sleep(delay)
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
            'Buys cracks from the darkweb.',
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
