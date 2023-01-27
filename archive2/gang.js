/** @param {NS} ns **/
export async function main(ns) {
    let loops = 0
    let ascentionCounter = 0
    let ascend = false
    let ascentionsComplete = 0

    while (true) {
        const myGang = ns.gang.getGangInformation()
        let availableCash = (ns.getServerMoneyAvailable('home'))
        ns.print("script has $" + availableCash + " available")
        const equipmentNames = ns.gang.getEquipmentNames()

        while (ns.gang.canRecruitMember()) {
            for (let i = 1; i <= 30; i++) {
                ns.gang.recruitMember('agent-' + i.toString().padStart(3, '0'))
            }
        }

        let members = ns.gang.getMemberNames()


        for (const member of members) {
            var memberInfo = ns.gang.getMemberInformation(member)
            for (const equipmentName of equipmentNames) {
                if (memberInfo.upgrades.indexOf(equipmentName) === -1) {
                    const cost = ns.gang.getEquipmentCost(equipmentName)
                    if (cost < availableCash) {
                        ns.gang.purchaseEquipment(member, equipmentName)
                        availableCash = availableCash - cost
                    }
                }
            }


            if (memberInfo.str < 50 || Math.random() < 0.2) {
                ns.gang.setMemberTask(member, 'Terrorism')
            } else if (Math.random() < 0.2 && memberInfo.str < 300) {
                ns.gang.setMemberTask(member, 'Territory Warfare')
            } else if (myGang.wantedPenalty < 0.9 && myGang.wantedLevel > 1.1) {
                ns.gang.setMemberTask(member, 'Vigilante Justice')
            } else if (memberInfo.str < 150) {
                ns.gang.setMemberTask(member, 'Mug People')
            } else if (memberInfo.str < 500) {
                ns.gang.setMemberTask(member, 'Strongarm Civilians')
            } else {
                ns.gang.setMemberTask(member, 'Traffick Illegal Arms')
            }
        }
        if (ascentionCounter > 75) {
            ascend = true
        }

        if (ascend) {
            let topResult = 0
            let topMember = '0'
            let result
            for (const member of members) {
                result = ns.gang.getAscensionResult(member)
                try {
                    if (result.str > topResult) {
                        topResult = result.str
                        topMember = member
                    }
                } catch (err) {
                }
            }
            ns.gang.ascendMember(topMember)
            ascentionCounter = 0
            ascend = false
            ascentionsComplete++
        }
        loops++
        ns.print('loop ' + loops + ' complete!')
        ns.print(ascentionsComplete + ' ascentions complete!')
        ascentionCounter++
        await ns.sleep(4000)
    }
}

