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
    const rootServers = new RootServers(ns, runner.nsProxy)
    // print help
    if (args.help) {
        ns.tprint(rootServers.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await rootServers.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    ns.run()
    ns.isRunning(0)
}

/**
 * RootServers
 *
 * Gains root access on any available servers.
 */
export class RootServers {

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
     * Server data, containing servers we own (home and purchased)
     * @type {Server[]}
     */
    myServers

    /**
     * Server data, containing servers rooted this run
     * @type {Server[]}
     */
    newlyRootedServers

    /**
     * Server data, containing servers we can run scripts on
     * @type {Server[]}
     */
    hackingServers

    /**
     * Server data, containing servers which are rootable
     * @type {Server[]}
     */
    rootableServers

    /**
     * Server data, containing servers with root access
     * @type {Server[]}
     */
    rootedServers

    /**
     * List of port hacks that are used to root servers
     * @type {Array}
     */
    cracks

    /**
     * List of port hacks that have been unlocked
     * @type {Array}
     */
    ownedCracks

    /**
     * List of hacks that are used to attack servers
     * @type {Object}
     */
    hacks

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
        if (this.lastRun + settings.intervals['root-servers'] > new Date().getTime()) {
            return
        }
        // run
        this.ns.tprint('RootServers...')
        await this.rootServers()
        // set the last run time
        this.lastRun = new Date().getTime()
        // display the report
        this.ns.tprint(this.getReport())
    }


    /**
     * Gain root access on any available servers.
     *
     * @returns {Promise<void>}
     */
    async rootServers() {
        // refresh data
        await this.loadPlayer()
        await this.loadCracks()
        await this.loadServers()
        // reset the list
        this.newlyRootedServers = []
        // run owned port hacks on rootable servers
        if (this.rootableServers.length) {
            for (const server of this.rootableServers) {
                // run port hacks
                for (const portHack of this.ownedCracks) {
                    await this.nsProxy[portHack.method](server.hostname)
                }
                // run nuke
                await this.nsProxy['nuke'](server.hostname)
                // copy hack scripts
                await this.nsProxy['scp'](Object.values(this.hacks).map(h => h.script), server.hostname)
                // run backdoor
                server.route.shift() // remove home
                for (const path of server.route) {
                    await this.terminalCommand(`connect ${path}`)
                }
                await this.terminalCommand('analyze', 5000)
                await this.terminalCommand('backdoor', server.requiredHackingSkill * 250 + 10000) // run backdoor and wait
                await this.terminalCommand('home')
                // add to list
                this.newlyRootedServers.push(server)
            }
            if (this.newlyRootedServers.length) {
                await this.loadServers()
            }
        }
        // copy hack scripts (needed for purchased servers, ideally do this somewhere else, maybe RootServers?)
        for (const server of this.hackingServers) {
            await this.nsProxy['scp'](Object.values(this.hacks).map(h => h.script), server.hostname)
        }
    }

    /**
     * Report for the attack.
     *
     * @returns {string}
     */
    getReport() {
        const ram = {
            total: this.hackingServers.map(s => s.maxRam).reduce((prev, next) => prev + next),
            used: this.hackingServers.map(s => s.ramUsed).reduce((prev, next) => prev + next),
        }
        const report = [
            '',
            '',
            '=====================',
            `|| 🖥 Root Servers ||`,
            '=====================',
            '',
            `${this.servers.length} servers found in the network:`,
            ` -> ${this.servers.map(s => s.hostname).join(', ')}`,
            '',
            `${this.myServers.length} servers are mine:`,
            ` -> ${this.myServers.map(s => s.hostname + ' = ' + s.ramUsed + '/' + s.maxRam + 'GB used').join(', ')}`,
            '',
            `${this.rootedServers.length} servers have root access:`,
            ` -> ${this.rootedServers.map(s => s.hostname + ' = ' + s.ramUsed + 'GB/' + s.maxRam + 'GB ' + this.ns.nFormat(s.moneyAvailable, '$0.0a') + '/' + this.ns.nFormat(s.moneyMax, '$0.0a') + ' ' + this.ns.nFormat(s.hackDifficulty, '0.0a') + '/' + this.ns.nFormat(s.minDifficulty, '0.0a')).join(', ')}`,
            '',
            `Memory Usage`,
            ` -> ${this.ns.nFormat(ram.used / ram.total, '0%')} - ${ram.used}GB/${ram.total}GB`,
        ]
        if (this.rootableServers.length) {
            report.push('')
            report.push(`${this.rootableServers.length} servers are within hacking level (${this.player.hacking})`)
            report.push(` -> ${this.rootableServers.map(s => s.hostname).join(', ')}`)
        }
        if (this.newlyRootedServers.length) {
            report.push('')
            report.push(`${this.newlyRootedServers.length} have been rooted!!`)
            report.push(` -> ${this.newlyRootedServers.map(s => s.hostname).join(', ')}`)
        }

        return "\n\n" + report.join("\n") + "\n\n\n"
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
     * Loads a list of port hacks.
     *
     * @returns {Promise<*[]>}
     */
    async loadCracks() {
        // load port hacks
        this.cracks = []
        const cracks = {
            brutessh: 'BruteSSH.exe',
            ftpcrack: 'FTPCrack.exe',
            relaysmtp: 'relaySMTP.exe',
            httpworm: 'HTTPWorm.exe',
            sqlinject: 'SQLInject.exe',
            // nuke: 'NUKE.exe', // not a port hack
        }
        for (const [method, exe] of Object.entries(cracks)) {
            this.cracks.push({
                method: method,
                exe: exe,
                owned: await this.nsProxy['fileExists'](exe, 'home'),
            })
        }
        // the ones we own
        this.ownedCracks = this.cracks
            .filter(a => a.owned)
    }

    /**
     * Loads a list of servers in the network.
     *
     * @returns {Promise<*[]>}
     */
    async loadServers() {
        // get servers in network
        this.servers = []
        const spider = ['home']
        const routes = {home: ["home"]}
        // run until the spider array is empty
        for (let i = 0; i < spider.length; i++) {
            const hostname = spider[i]
            // for all the connected hosts
            for (const scannedHostName of await this.nsProxy['scan'](hostname)) {
                // if they are not in the list
                if (this.servers.filter(s => s.hostname === scannedHostName).length === 0) {
                    // add them to the spider list
                    spider.push(scannedHostName)
                    // record the route
                    routes[scannedHostName] = routes[hostname].slice()
                    routes[scannedHostName].push(scannedHostName)
                }
            }
            // get the server info
            const server = await this.nsProxy['getServer'](hostname)
            server.route = routes[hostname]
            // reserve memory on home
            if (server.hostname === 'home') {
                server.ramUsed = Math.min(server.ramUsed + settings.reservedHomeRam, server.maxRam)
            }
            // add this server to the list
            this.servers.push(server)
        }

        // get my servers
        this.myServers = this.servers
            // include home//homenet-
            .filter(s => s.hostname === 'home' || s.hostname.includes(settings.purchasedServerPrefix))

        // get rootable servers
        this.rootableServers = this.servers
            // exclude servers with root access
            .filter(s => !s.hasAdminRights)
            // include servers within hacking level and where we own enough port hacks
            .filter(s => s.requiredHackingSkill <= this.player.hacking && s.numOpenPortsRequired <= this.ownedCracks.length)

        // get rooted servers
        this.rootedServers = this.servers
            // exclude home/hacknet-/homenet-
            .filter(s => s.hostname !== 'home' && !s.hostname.includes('hacknet-') && !s.hostname.includes(settings.purchasedServerPrefix))
            // include servers with root access
            .filter(s => s.hasAdminRights)

        // get servers used for hacking
        this.hackingServers = this.servers
            // exclude hacknet-
            .filter(s => !s.hostname.includes('hacknet-'))
            // include servers with root access
            .filter(s => s.hasAdminRights)

        // load the hacks each time after servers are loaded
        await this.loadHacks()
    }

    /**
     * Loads a list of hacks
     *
     * @returns {Promise<*[]>}
     */
    async loadHacks() {
        this.hacks = {
            weaken: {
                script: '/hacks/weaken.js',
            },
            grow: {
                script: '/hacks/grow.js',
            },
            hack: {
                script: '/hacks/hack.js',
            },
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
            'Gains root access on any available servers.',
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
