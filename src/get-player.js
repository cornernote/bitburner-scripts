import {App} from "./includes/Application";

/** @param {NS} ns **/
export async function main(ns) {
    let a = new App;
    a.init(ns);
    a.logger.log('Starting get-player.js', true);
    a.cache.setItem('player', ns.getPlayer(), 10)
    a.logger.log('Player data has been saved!', true);
}

