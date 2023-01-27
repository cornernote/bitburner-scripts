/**
 * Faction helper functions
 */


/**
 * Returns how much reputation you need in total with a faction or company to reach the favor favorTarget.
 *
 * (as of v0.37.1, the constants are the same for factions and companies)
 * formula adapted from Faction.js/getFavorGain(), Company.js/getFavorGain() and Constants.js:
 * https://github.com/danielyxie/bitburner/blob/master/src/Faction.js
 *
 * @author sschmidTU
 */
export function repNeededForFavor(targetFavor) {
    const reputationToFavorBase = 500
    const reputationToFavorMult = 1.02
    let favorGain = 0
    let rep = 0
    let requiredRep = reputationToFavorBase
    while (favorGain < targetFavor) {
        rep += requiredRep
        ++favorGain
        requiredRep *= reputationToFavorMult
    }
    return rep
}
