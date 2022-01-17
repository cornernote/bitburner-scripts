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
    const attackServers = new AttackServers(ns, nsProxy)
    // print help
    if (args.help) {
        ns.tprint(attackServers.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await attackServers.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    // comment if using nsProxy
    ns.fileExists()
    ns.exec()
    ns.getPlayer()
    ns.scan()
    ns.getServer('home')
    ns.exec('fake.js', 'home')
    ns.getGrowTime('home')
    ns.getHackTime('home')
    ns.getWeakenTime('home')
    ns.hackAnalyzeThreads('home', 1)
    ns.hackAnalyze('home')
    ns.growthAnalyze('home', 1)
    ns.kill()
}


/**
 * AttackServers
 *
 * Launch a hack attack for profit.
 */
export class AttackServers {

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
     * Server data, containing servers we can run scripts on
     * @type {Server[]}
     */
    hackingServers

    /**
     * Server data, sorted by hack value
     * @type {Server[]}
     */
    targetServers

    /**
     * List of hacks that are used to attack servers
     * @type {Object}
     */
    hacks = {
        hack: {
            script: '/hacks/hack.js',
            change: 0.002,
            ram: 1.7,
        },
        grow: {
            script: '/hacks/grow.js',
            change: 0.004,
            ram: 1.75,
        },
        weaken: {
            script: '/hacks/weaken.js',
            change: 0.05,
            ram: 1.75,
        },
    }

    /**
     * List of attacks we will be running to hack servers
     * @type {Array}
     */
    attacks = []

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
     * Launch a hack attack for profit.
     *
     * @returns {Promise<void>}
     */
    async doJob() {
        // check if we need to run
        if (this.lastRun + settings.intervals['attack-servers'] > new Date().getTime()) {
            return
        }
        this.ns.print('AttackServers...')
        // run the attacks
        await this.attackServers()
        // set the last run time
        this.lastRun = new Date().getTime()
    }

    /**
     * Build and run attacks
     *
     * @returns {Promise<void>}
     */
    async attackServers() {
        // this.ns.tprint('init')
        await this.loadPlayer()
        await this.loadServers()

        // this.ns.tprint('----------')

        // load attacks from disk
        this.attacks = await this.nsProxy['fileExists']('/data/attacks.json.txt')
            ? JSON.parse(this.ns.read('/data/attacks.json.txt'))
            : []

        // clean ended attacks
        this.attacks = this.attacks
            .filter(a => !a.start || a.start + a.time > new Date().getTime())

        // this.ns.tprint('get new attacks')

        // get new attacks
        let attacks = []
        let freeRam = this.hackingServers
            .map(s => (s.maxRam - s.ramUsed) >= 1.75 ? (s.maxRam - s.ramUsed) : 0)
            .reduce((prev, next) => prev + next)
        for (const server of this.targetServers) {
            let attack = await this.buildAttack(server)
            if (!attack) {
                continue
            }
            // initial check for free ram, needed to retry if we aren't running any attacks
            if ((attack.action === 'hack' || attack.action === 'force') && attack.ram > freeRam) {
                //this.ns.tprint(`${attack.target} ${attack.action} needs ${this.formatRam(attack.ram)}, only ${this.formatRam(freeRam)} available`)
                continue
            }
            // this.ns.tprint(`added ${attack.target} to ${attack.action}`)
            attacks.push(attack)
        }

        // this.ns.tprint('no attacks, try with less percent')

        // no attacks, try with less percent
        if (!this.attacks.filter(a => a.action === 'hack' || a.action === 'force').length) {
            let hackPercent = 1
            while (!attacks.filter(a => a.action === 'hack' || a.action === 'force').length) {
                // this.ns.tprint(`NO ATTACKS, lower percent...`)
                hackPercent *= 0.5
                for (const server of this.targetServers) {
                    let attack = await this.buildAttack(server, hackPercent)
                    if (!attack) {
                        continue
                    }
                    if (attack.ram > freeRam) {
                        // this.ns.tprint(`${attack.target} ${attack.action} needs ${this.formatRam(attack.ram)}, only ${this.formatRam(freeRam)} available`)
                        continue
                    }
                    // this.ns.tprint(`added ${attack.target} to ${attack.action}`)
                    attacks.push(attack)
                }
            }
        }

        // sort hacks at the top, preps last
        const hackAttacks = attacks.filter(a => a.action === 'hack' || a.action === 'force').splice(0, 10)
        const prepAttacks = attacks.filter(a => a.action !== 'hack' && a.action !== 'force')

        // this.ns.tprint('assign hack attacks to a server')

        // assign hack attacks to a server
        for (let attack of hackAttacks) {
            // check for free ram
            let freeRam = this.hackingServers
                .map(s => (s.maxRam - s.ramUsed) >= 1.75 ? (s.maxRam - s.ramUsed) : 0)
                .reduce((prev, next) => prev + next)
            if (attack.ram > freeRam) {
                //this.ns.tprint(`${attack.target} ${attack.action} needs ${this.formatRam(attack.ram)}, only ${this.formatRam(freeRam)} available`)
                continue
            }
            // assign the commands and server ram
            attack = await this.assignAttack(attack)
            if (!attack) {
                continue
            }
            // run the commands
            attack = await this.launchAttack(attack)
            // add to the stack
            this.attacks.push(attack)
        }

        // this.ns.tprint('assign prep attacks to a server, use all free ram, only if we have a hack running')

        // assign prep attacks to a server
        for (let attack of prepAttacks) {
            // check for free ram
            let freeRam = this.hackingServers
                .map(s => (s.maxRam - s.ramUsed) >= 1.75 ? (s.maxRam - s.ramUsed) : 0)
                .reduce((prev, next) => prev + next)
            if (attack.ram > freeRam) {
                //this.ns.tprint(`${attack.target} ${attack.action} needs ${this.formatRam(attack.ram)}, only ${this.formatRam(freeRam)} available`)
                continue
            }
            // assign the commands and server ram
            attack = await this.assignAttack(attack, true)
            if (!attack) {
                continue
            }
            // run the commands
            attack = await this.launchAttack(attack)
            // add to the stack
            this.attacks.push(attack)
        }

        this.ns.tprint('write the attacks to disk')

        // write the attacks to disk
        await this.ns.write('/data/attacks.json.txt', JSON.stringify(this.attacks), 'w')
        this.ns.tprint('done!')
    }

    /**
     * Launches an attack
     *
     * @param attack
     * @returns {Promise<Boolean|{hacks: {}, pids: [], action: string, uuid: string, value: number, start: number, time: number, delay: number, commands: *[], target: any, ram: number}>}
     */
    async launchAttack(attack) {
        for (const command of attack.commands) {
            let retry = 5,
                pid = 0
            for (let i = retry; i > 0; i--) {
                pid = await this.nsProxy['exec'](...command)
                if (pid) {
                    await this.ns.sleep(1) // sleep to prevent error: cannot be run because it does not have a main function.
                    break
                }
                await this.ns.sleep(100)
            }
            if (!pid) {
                this.ns.tprint(`WARNING! could not start command: ${JSON.stringify(command)}`)
            }
            attack.pids.push(pid)
        }
        attack.start = new Date().getTime()

        // // log the calculations
        // let hostAttacks = this.attacks.filter(a => a.target === attack.target)
        // const hacks = attack.hacks,
        //     h = hacks['hack'],
        //     hw = hacks['hackWeaken'],
        //     g = hacks['grow'],
        //     gw = hacks['growWeaken'],
        //     w = hacks['weaken']
        // const log = this.formatTime() + ': ' + [
        //     `${attack.target} ${attack.action} `,
        //     `h=${h.threads}+${hw.threads}/g=${g.threads}+${gw.threads}/w=${w.threads}`,
        //     `${this.formatDelay(attack.time)}`,
        //     `${this.formatRam(attack.ram)}`,
        //     `${this.ns.nFormat(attack.value, '$0.0a')}`,
        //     `(${hostAttacks.length})`
        // ].join(' | ')
        // this.ns.tprint(log)
        // //await this.ns.write('/logs/attack-servers.log.txt', log + "\n", 'a')

        return attack
    }

    /**
     * Distribute the attack threads between our hacking servers
     *
     * @param attack
     * @param allowRamOverflow
     * @returns {Promise<Boolean|{hacks: {}, pids: [], action: string, uuid: string, value: number, start: number, time: number, delay: number, commands: *[], target: any, ram: number}>}
     */
    async assignAttack(attack, allowRamOverflow = false) {
        for (const hack of Object.values(attack.hacks)) {
            let threadsRemaining = hack.threads
            for (const server of this.hackingServers) {
                const threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / hack.ram))
                const threadsToRun = Math.max(0, Math.min(threadsFittable, threadsRemaining))
                if (threadsToRun) {
                    //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock, 7: tprint, 8: toast]
                    attack.commands.push([hack.script, server.hostname, threadsToRun, attack.target, hack.delay, attack.uuid, false, false, false])
                    threadsRemaining -= threadsToRun
                    server.ramUsed += threadsToRun * hack.ram
                }
            }
            // check for overflow
            if (!allowRamOverflow && threadsRemaining) {
                //this.ns.tprint(`WARNING! some threads do not fit in ram - h=${h.threadsRemaining}/g=${g.threadsRemaining}/w=${w.threadsRemaining}`)
                return false
            }
        }
        return attack
    }

    /**
     * Build the attack plan
     *
     * @param target
     * @param hackPercent
     * @returns {Promise<Boolean|{hacks: {}, pids: [], action: string, uuid: string, value: number, start: number, time: number, delay: number, commands: *[], target: any, ram: number}>}
     */
    async buildAttack(target, hackPercent = 1) {

        // create the attack structure
        const attack = {
            uuid: this.generateUUID(),
            target: target.hostname,
            value: 0,
            ram: 0,
            start: 0,
            time: 0,
            delay: 0,
            action: 'hack',
            hacks: {},
            commands: [],
            pids: [],
        }

        // build the hack list
        // name: {
        //     script:      // target script
        //     ram:         // ram needed (calculated below)
        //     change:      // security change per thread
        //     time:        // time to run
        //     delay:       // delay ensures hacks finish in order (calculated below)
        //     threads:     // how many threads to run
        // }
        for (const [name, _hack] of Object.entries(this.hacks)) {
            attack.hacks[name] = {}
            attack.hacks[name].script = _hack.script
            attack.hacks[name].change = _hack.change
            attack.hacks[name].ram = _hack.ram
            //attack.hacks[name].ram = await this.nsProxy['getScriptRam'](attack.hacks[name].script)
            attack.hacks[name].time = await this.nsProxy[`get${name[0].toUpperCase()}${name.slice(1)}Time`](target.hostname)
            attack.hacks[name].delay = 0
            attack.hacks[name].threads = 0
        }
        for (const hack of ['hackWeaken', 'growWeaken']) {
            attack.hacks[hack] = {}
            attack.hacks[hack].script = attack.hacks['weaken'].script
            attack.hacks[hack].change = attack.hacks['weaken'].change
            attack.hacks[hack].ram = attack.hacks['weaken'].ram
            attack.hacks[hack].time = attack.hacks['weaken'].time
            attack.hacks[hack].delay = 0
            attack.hacks[hack].threads = 0
        }

        // expose vars for shorter code below
        const hacks = attack.hacks,
            h = attack.hacks['hack'],
            g = attack.hacks['grow'],
            hw = attack.hacks['hackWeaken'],
            gw = attack.hacks['growWeaken'],
            w = attack.hacks['weaken']

        const totalRam = this.hackingServers
            .map(s => s.maxRam)
            .reduce((prev, next) => prev + next)

        // the server values will change after hack, until weaken, ensure this time is minimised
        // plan delays so order lands as: hack(), weaken(), grow(), weaken()
        h.delay = hw.time - h.time - 200
        gw.delay = 400
        g.delay = gw.time + gw.delay - g.time - 200
        attack.time = gw.time + gw.delay + 200

        // decide which action to perform
        // - if security is not min or money is not max then action=prep
        if (target.hackDifficulty > target.minDifficulty + settings.minSecurityLevelOffset) {
            attack.action = 'weaken'
        } else if (target.moneyAvailable < target.moneyMax * settings.maxMoneyMultiplayer) {
            attack.action = 'grow'
        }
        if (totalRam > 100000 && (attack.action === 'weaken' || attack.action === 'grow')) {
            attack.action = 'prep'
        }

        // check for overlapping grow/weaken attacks
        const hostAttacks = this.attacks
            .filter(a => a.target === target.hostname)
        const currentPrepAttacks = hostAttacks.filter(a => a.action !== 'hack' && a.action !== 'force')
        const currentHackAttacks = hostAttacks.filter(a => a.action === 'hack' || a.action === 'force')
        if (currentPrepAttacks.length) {
            //this.ns.tprint(`${attack.target} tried to prep when prep is in progress`)
            return false
        }
        if (attack.action === 'prep' && currentHackAttacks.length) {
            attack.action = 'force'
        }

        if (attack.action === 'prep') {
            // notify the stats to reset
            await this.ns.writePort(1, JSON.stringify({target: target.hostname, action: 'start'}))
        }

        // check for low percent of success, and kill the attack
        if (attack.action === 'force') {
            const stats = await this.nsProxy['fileExists']('/data/stats.json.txt')
                ? JSON.parse(this.ns.read('/data/stats.json.txt'))
                : {}
            const stat = stats[attack.target]
            if (stat && (stat.success / stat.attempts < target.successChance * 0.8 || stat.consecutiveFailures > 50)) {
                // this.ns.tprint(`WARNING: ${stat.target} percent too low (${(stat.success / stat.attempts)} vs ${target.successChance})... killing ${hostAttacks.length} attacks...`)
                for (const attack of hostAttacks) {
                    for (const pid of attack.pids) {
                        if (pid) {
                            await this.nsProxy['kill'](pid)
                            await this.ns.sleep(10) // prevent freezing
                        }
                    }
                }
                // wait a bit for any port data to clear
                await this.ns.sleep(200)
                // remove the host from the list
                this.attacks = this.attacks.filter(a => a.target !== attack.target)
                // notify the stats to reset
                await this.ns.writePort(1, JSON.stringify({target: target.hostname, action: 'restart'}))
                return false
            }
        }

        const cores = 1

        // calculate the thread counts
        switch (attack.action) {

            // calculate threads to WEAKEN the target
            case 'weaken':
                w.threads = Math.ceil((target.hackDifficulty - target.minDifficulty) / w.change)
                break

            // calculate threads to GROW the target
            case 'grow':
                g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, target.moneyMax / target.moneyAvailable, cores))
                gw.threads = Math.ceil((g.threads * g.change) / gw.change)
                break

            // calculate threads to PREP the target
            case 'prep': // weaken+grow
                w.threads = Math.ceil((target.hackDifficulty - target.minDifficulty) / w.change)
                g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, target.moneyMax / target.moneyAvailable, cores))
                gw.threads = Math.ceil((g.threads * g.change) / gw.change)
                break

            // calculate threads to HACK the target
            case 'hack':
                h.threads = Math.ceil(await this.nsProxy['hackAnalyzeThreads'](target.hostname, target.moneyAvailable * settings.hackPercent * hackPercent))
                const hackedPercent = await this.nsProxy['hackAnalyze'](target.hostname) * h.threads
                if (1 / (1 - hackedPercent) < 1) {
                    return false // maybe an overlap?
                }
                g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, 1 / (1 - hackedPercent), cores))
                hw.threads = Math.ceil(h.threads * (h.change / w.change))
                gw.threads = Math.ceil(g.threads * (g.change / w.change))
                attack.value = target.moneyAvailable * hackedPercent
                break

            // note - if we have a current hack, the above hack() threads be wrong because grow() and weaken() are not complete
            case 'force':
                let currentHackAttack = currentHackAttacks.pop()
                attack.value = currentHackAttack.value
                h.threads = currentHackAttack.hacks['hack'].threads
                g.threads = currentHackAttack.hacks['grow'].threads
                w.threads = currentHackAttack.hacks['weaken'].threads
                break

        }

        // calculate the attack ram usage (do not allocate ram or set commands yet)
        attack.ram = h.threads * h.ram
            + hw.threads * hw.ram
            + g.threads * g.ram
            + gw.threads * gw.ram
            + w.threads * w.ram

        return attack
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
     * Loads a list of servers in the network.
     *
     * @returns {Promise<*[]>}
     */
    async loadServers() {

        // get servers in network
        this.servers = []
        const spider = ['home']
        // run until the spider array is empty
        while (spider.length > 0) {
            const hostname = spider.pop()
            // for all the connected hosts
            for (const scannedHostName of await this.nsProxy['scan'](hostname)) {
                // if they are not in the list
                if (this.servers.filter(s => s.hostname === scannedHostName).length === 0) {
                    // add them to the spider list
                    spider.push(scannedHostName)
                }
            }
            // get the server info
            const server = await this.nsProxy['getServer'](hostname)
            // reserve memory on home
            if (server.hostname === 'home') {
                server.ramUsed = Math.min(server.ramUsed + settings.reservedHomeRam, server.maxRam)
            }
            // add this server to the list
            this.servers.push(server)
        }

        // get hacking servers (servers we can use to run scripts)
        this.hackingServers = this.servers
            // exclude hacknet-
            .filter(s => !s.hostname.includes('hacknet') && !s.hostname.includes('darkweb'))
            // include servers with root access
            .filter(s => s.hasAdminRights)
            // order by ram
            .sort((a, b) => b.maxRam - a.maxRam)

        // get target servers (servers to attack)
        this.targetServers = this.servers
            // exclude home/hacknet-/homenet-
            .filter(s => s.hostname !== 'home'
                && !s.hostname.includes('hacknet')
                && !s.hostname.includes('darkweb')
                && !s.hostname.includes(settings.purchasedServerPrefix))
            // include servers with root access
            .filter(s => s.hasAdminRights)
            // include servers with money
            .filter(s => s.moneyMax > 0)
        // .filter(s => s.hostname === 'foodnstuff' || s.hostname === 'n00dles' || s.hostname === 'joesguns' || s.hostname === 'zer0')

        // get some more info about the servers
        for (const server of this.targetServers) {
            const skillMult = (1.75 * this.player.hacking) + (0.2 * this.player.intelligence)
            const skillChance = 1 - (server.requiredHackingSkill / skillMult)
            const difficultyMult = (100 - server.minDifficulty) / 100
            server.successChance = Math.min(1, skillChance * difficultyMult * this.player.hacking_chance_mult)
            server.hackValue = server.moneyMax * server.successChance * settings.hackPercent
        }
        // get servers in order of hack value
        this.targetServers = this.targetServers.sort((a, b) => b.hackValue - a.hackValue)
    }

    /**
     * Format RAM as string
     *
     * @param gb
     * @returns {string}
     */
    formatRam(gb) {
        return this.ns.nFormat(gb * 1000 * 1000 * 1000, '0.0b')
    }

    /**
     * Format a delay and end time
     *
     * @param delay time in milliseconds
     * @param end time in milliseconds
     * @returns {string}
     */
    formatDelays(delay, end) {
        return this.formatDelay(delay) + '-' + this.formatDelay(end)
    }

    /**
     * Format a delay in MM:SS
     * Allows negative times (nsFormat didn't work)
     *
     * @param value time in milliseconds
     * @returns {string}
     */
    formatDelay(value) {
        value = value / 1000
        let hours = Math.floor(Math.abs(value) / 60 / 60),
            minutes = Math.floor((Math.abs(value) - (hours * 60 * 60)) / 60),
            seconds = Math.round(Math.abs(value) - (hours * 60 * 60) - (minutes * 60))
        return (value < 0 ? '-' : '')
            + (hours ? hours + ':' : '')
            + minutes
            + ':' + (seconds < 10 ? '0' + seconds : seconds)
    }

    /**
     * Format a delay and end time
     *
     * @param delay time in milliseconds
     * @param end time in milliseconds
     * @returns {string}
     */
    formatTimes(delay, end) {
        return this.formatTime(delay) + '-' + this.formatTime(end)
    }

    /**
     * Format a locale time in HH:MM:SS
     *
     * @param value time in milliseconds
     * @returns {string}
     */
    formatTime(value = 0) {
        if (!value) {
            value = new Date().getTime()
        }
        return new Date(value).toLocaleTimeString()
    }

    /**
     * Generate a UUIDv4 string
     * @returns {string}
     */
    generateUUID() {
        let dt = new Date().getTime()
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = (dt + Math.random() * 16) % 16 | 0
            dt = Math.floor(dt / 16)
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
        })
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
            'Launch a hack attack for profit.',
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