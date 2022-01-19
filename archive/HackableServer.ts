import {BitNodeMultipliers as IBitNodeMultipliers, Player as IPlayer, Server as IServer} from "../stubs";
import {CONSTANTS} from "./Constants";

export class Server implements IServer {
    backdoorInstalled: boolean
    baseDifficulty: number
    cpuCores: number
    ftpPortOpen: boolean
    hackDifficulty: number
    hasAdminRights: boolean
    hostname: string
    httpPortOpen: boolean
    ip: string
    isConnectedTo: boolean
    maxRam: number
    minDifficulty: number
    moneyAvailable: number
    moneyMax: number
    numOpenPortsRequired: number
    openPortCount: number
    organizationName: string
    purchasedByPlayer: boolean
    ramUsed: number
    requiredHackingSkill: number
    serverGrowth: number
    smtpPortOpen: boolean
    sqlPortOpen: boolean
    sshPortOpen: boolean

    player: IPlayer
    bitNodeMultipliers: IBitNodeMultipliers


    // need to know...
    //
    // value per thread (server ready to hack)
    // we have limited ram and need to get profit
    // Servers.bestHackTarget(ram?)
    // Servers.currentHackTargets = []
    //
    // value per thread now (server needs prep)
    // we have spare ram and want to prep a new target...
    // get the best one based on the cost-per-thread to prep
    // Servers.bestPrepTarget()
    // Servers.currentPrepTargets = []

    calculateWeakenThreads(): any {
        // return Math.ceil((this.hackDifficulty - this.minDifficulty) / w.change)
    }


    calculateGrowThreads(): any {
        g.threads = Math.ceil(this.growthAnalyze(this.moneyMax / this.moneyAvailable))
        // gw.threads = Math.ceil((g.threads * g.change) / gw.change)
    }

    calculateHackThreads(): any {
        // h.threads =
        // hw.threads =
        // g.threads = Math.ceil(this.growthAnalyze)
        // gw.threads = Math.ceil((g.threads * g.change) / gw.change)
    }

    /**
     * Predict the value a full hack.
     *
     * @returns The the amount of money that can be stolen per cycle.
     */
    hackValue(hackPercent: any): any {
        if (isNaN(hackPercent)) {
            throw `Invalid hackPercent argument passed into hackValue: ${hackPercent}. Must be numeric.`
        }
        const difficultyMult = (100 - this.minDifficulty) / 100
        const skillMult = (this.player.hacking - (this.requiredHackingSkill - 1)) / this.player.hacking;
        const skillChance = 1 - (this.requiredHackingSkill / skillMult)
        const successChance = Math.min(1, skillChance * difficultyMult * this.player.hacking_chance_mult)
        return this.moneyMax * successChance
    }

    growthAnalyze(growth: any, cores: any = 1): any {
        if (typeof growth !== "number" || isNaN(growth) || growth < 1 || !isFinite(growth)) {
            throw `Invalid argument: growth must be numeric and >= 1, is ${growth}.`;
        }
        return this.numCycleForGrowth(Number(growth), cores);
    }

    /**
     * Predict the effect of hack.
     *
     * @returns The number of threads needed to hack the server for hackAmount money.
     */
    hackAnalyzeThreads(hackAmount: any): any {
        if (isNaN(hackAmount)) {
            throw `Invalid hackAmount argument passed into hackAnalyzeThreads: ${hackAmount}. Must be numeric.`
        }
        // if (hackAmount < 0 || hackAmount > this.moneyAvailable) {
        if (hackAmount < 0 || hackAmount > this.moneyMax) { // assume server will have moneyMax
            return -1
        } else if (hackAmount === 0) {
            return 0
        }
        const percentHacked = this.calculatePercentMoneyHacked()
        // return hackAmount / Math.floor(this.moneyAvailable * percentHacked)
        return hackAmount / Math.floor(this.moneyMax * percentHacked) // assume server will have moneyMax
    }

    /**
     * Returns the percentage of money that will be stolen from a server if
     * it is successfully hacked (returns the decimal form, not the actual percent value)
     */
    calculatePercentMoneyHacked(): any {
        // Adjust if needed for balancing. This is the divisor for the final calculation
        const balanceFactor = 240
        //const difficultyMult = (100 - this.hackDifficulty) / 100
        const difficultyMult = (100 - this.minDifficulty) / 100 // assume server will have minDifficulty
        const skillMult = (this.player.hacking - (this.requiredHackingSkill - 1)) / this.player.hacking
        const percentMoneyHacked = (difficultyMult * skillMult * this.player.hacking_money_mult * this.bitNodeMultipliers.ScriptHackMoney) / balanceFactor
        if (percentMoneyHacked < 0) {
            return 0
        }
        if (percentMoneyHacked > 1) {
            return 1
        }
        return percentMoneyHacked
    }


    /**
     * Returns the chance the player has to successfully hack a server
     */
    calculateHackingChance(): number {
        const hackFactor = 1.75
        const difficultyMult = (100 - this.hackDifficulty) / 100
        const skillMult = hackFactor * this.player.hacking
        const skillChance = (skillMult - this.requiredHackingSkill) / skillMult
        const chance =
            skillChance * difficultyMult * this.player.hacking_chance_mult * this.calculateIntelligenceBonus(1)
        if (chance > 1) {
            return 1
        }
        if (chance < 0) {
            return 0
        }
        return chance
    }

    /**
     * Returns the amount of hacking experience the player will gain upon
     * successfully hacking a server
     */
    calculateHackingExpGain(): number {
        const baseExpGain = 3
        const diffFactor = 0.3
        if (this.baseDifficulty == null) {
            this.baseDifficulty = this.hackDifficulty
        }
        let expGain = baseExpGain
        expGain += this.baseDifficulty * this.player.hacking_exp_mult * diffFactor
        return expGain * this.bitNodeMultipliers.HackExpGain
    }

    /**
     * Returns time it takes to complete a hack on a server, in seconds
     */
    calculateHackingTime(): number {
        const difficultyMult = this.requiredHackingSkill * this.hackDifficulty
        const baseDiff = 500
        const baseSkill = 50
        const diffFactor = 2.5
        let skillFactor = diffFactor * difficultyMult + baseDiff
        // tslint:disable-next-line
        skillFactor /= this.player.hacking + baseSkill
        const hackTimeMultiplier = 5
        return (hackTimeMultiplier * skillFactor) /
            (this.player.hacking_speed_mult * this.calculateIntelligenceBonus(1))
    }

    /**
     * Returns time it takes to complete a grow operation on a server, in seconds
     */
    calculateGrowTime(): number {
        const growTimeMultiplier = 3.2 // Relative to hacking time. 16/5 = 3.2
        return growTimeMultiplier * this.calculateHackingTime()
    }

    /**
     * Returns time it takes to complete a weaken operation on a server, in seconds
     */
    calculateWeakenTime(): number {
        const weakenTimeMultiplier = 4 // Relative to hacking time
        return weakenTimeMultiplier * this.calculateHackingTime()
    }

    /**
     * Returns the intelligence bonus
     */
    calculateIntelligenceBonus(weight = 1): number {
        return 1 + (weight * Math.pow(this.player.intelligence, 0.8)) / 600
    }

    /**
     * Returns the number of "growth cycles" needed to grow the specified server by the
     * specified amount.
     * @param growth - How much the server is being grown by, in DECIMAL form (e.g. 1.5 rather than 50)
     * @param cores
     * @returns Number of "growth cycles" needed
     */
    numCycleForGrowth(growth: number, cores = 1): number {
        let ajdGrowthRate = 1 + (CONSTANTS.ServerBaseGrowthRate - 1) / this.hackDifficulty;
        if (ajdGrowthRate > CONSTANTS.ServerMaxGrowthRate) {
            ajdGrowthRate = CONSTANTS.ServerMaxGrowthRate;
        }
        const serverGrowthPercentage = this.serverGrowth / 100;
        const coreBonus = 1 + (cores - 1) / 16;
        return Math.log(growth) /
            (Math.log(ajdGrowthRate) *
                this.player.hacking_grow_mult *
                serverGrowthPercentage *
                this.bitNodeMultipliers.ServerGrowthRate *
                coreBonus);
    }
}


