module.exports = {
    partsChance: {
        lowTier: ['bamboo', 'corn', 'blueberry', 'grape', 'oats'], //crops that have lower chance based on high frequency harvests
        midTier: ['carrot', 'yam', 'beet', 'parsnip', 'hops', 'potato', 'strawberry'],
        highTier: ['melon', 'cauliflower', 'pumpkin'], //crops that have higher chance based on low frequency harvets
    },
    machineTypeIDS: {
        'cheese': 0,
        'cloth': 1,
        'mayonnaise': 2
    },
    machineTypeFromIDS: ['cheese', 'cloth', 'mayonnaise'],
    cheeseMachineInfo: {
        validInputs: ['cow_milk', 'yak_milk', 'goat_milk'],
        tier1: {
            capacity: 10,
            timeInMs: 1200000, //20 mins (4 min each)
            /* probabilities is probability of q3, then q2, then q1, then q0. The first one the random() is less than is quality
            ex: [0.10, 0.40, 0.60, 1.00] means 10% chance of q3, 30% chance of q2, 20% of q1, 40% of q0, based on probability of being NOT below earlier but earlier than current elem
            So obviously, the final number should always be 1
            */
            probabilities: [0.00, 0.10, 0.40, 1.00]
        },
        tier2: {
            capacity: 25,
            timeInMs: 2100000, //35 mins (3.5 min each)
            probabilities: [0.10, 0.50, 0.90, 1.00]
        },
        tier3: {
            capacity: 40,
            timeInMs: 3000000, //50 mins (2 min each)
            probabilities: [0.25, 0.70, 1.00, -1.00]
        },
    },
    clothMachineInfo: {
        validInputs: ['sheep_wool', 'llama_wool'],
        tier1: {
            capacity: 10,
            timeInMs: 1200000, //20 mins (4 min each)
            /* probabilities is probability of q3, then q2, then q1, then q0. The first one the random() is less than is quality
            ex: [0.10, 0.40, 0.60, 1.00] means 10% chance of q3, 30% chance of q2, 20% of q1, 40% of q0, based on probability of being NOT below earlier but earlier than current elem
            So obviously, the final number should always be 1
            */
            probabilities: [0.00, 0.10, 0.40, 1.00]
        },
        tier2: {
            capacity: 25,
            timeInMs: 2100000, //35 mins (3.5 min each)
            probabilities: [0.10, 0.50, 0.90, 1.00]
        },
        tier3: {
            capacity: 40,
            timeInMs: 3000000, //50 mins (2 min each)
            probabilities: [0.25, 0.70, 1.00, -1.00]
        },
    },
    mayonnaiseMachineInfo: {
        validInputs: ['chicken_egg', 'duck_egg', 'quail_egg', 'ostrich_egg', 'kiwi_egg'],
        tier1: {
            capacity: 10,
            timeInMs: 1200000, //20 mins (4 min each)
            /* probabilities is probability of q3, then q2, then q1, then q0. The first one the random() is less than is quality
            ex: [0.10, 0.40, 0.60, 1.00] means 10% chance of q3, 30% chance of q2, 20% of q1, 40% of q0, based on probability of being NOT below earlier but earlier than current elem
            So obviously, the final number should always be 1
            */
            probabilities: [0.00, 0.10, 0.40, 1.00]
        },
        tier2: {
            capacity: 25,
            timeInMs: 2100000, //35 mins (3.5 min each)
            probabilities: [0.10, 0.50, 0.90, 1.00]
        },
        tier3: {
            capacity: 40,
            timeInMs: 3000000, //50 mins (2 min each)
            probabilities: [0.25, 0.70, 1.00, -1.00]
        },
    },
    cheeseMachineCost: {
        // tier 1 is basic
        tier1: {
            Money: 5000,
            Gears: 1,
            MetalSheets: 4,
            Bolts: 3,
        },
        // tier 2 is first upgrade
        tier2: {
            Money: 20000,
            Gears: 15,
            MetalSheets: 30,
            Bolts: 15,
        },
        // tier 3 is second upgrade
        tier3: {
            Money: 100000,
            Gears: 20,
            MetalSheets: 65,
            Bolts: 15,
        },

    },
    clothMachineCost: {
        // tier 1 is basic
        tier1: {
            Money: 5000,
            Gears: 4,
            MetalSheets: 2,
            Bolts: 2,
        },
        // tier 2 is first upgrade
        tier2: {
            Money: 20000,
            Gears: 15,
            MetalSheets: 15,
            Bolts: 20,
        },
        // tier 3 is second upgrade
        tier3: {
            Money: 100000,
            Gears: 30,
            MetalSheets: 25,
            Bolts: 45,
        },
    },
    mayonnaiseMachineCost: {
        // tier 1 is basic
        tier1: {
            Money: 5000,
            Gears: 4,
            MetalSheets: 2,
            Bolts: 3,
        },
        // tier 2 is first upgrade
        tier2: {
            Money: 20000,
            Gears: 25,
            MetalSheets: 15,
            Bolts: 10,
        },
        // tier 3 is second upgrade
        tier3: {
            Money: 100000,
            Gears: 60,
            MetalSheets: 25,
            Bolts: 15,
        },
    },
    sellRefunds: {
        tier1: {
            Gears: 1,
            MetalSheets: 1,
            Bolts: 1,
        },
        tier2: {
            Gears: 5,
            MetalSheets: 5,
            Bolts: 5,
        },
        tier3: {
            Gears: 15,
            MetalSheets: 15,
            Bolts: 15,
        },
    },
    artisanPrices: {
        cheeseQ0: 600,
        cheeseQ1: 900,
        cheeseQ2: 1200,
        cheeseQ3: 1500,
        clothQ0: 500,
        clothQ1: 800,
        clothQ2: 1200,
        clothQ3: 1800,
        mayonnaiseQ0: 400,
        mayonnaiseQ1: 750,
        mayonnaiseQ2: 1000,
        mayonnaiseQ3: 1500,
    }
}




