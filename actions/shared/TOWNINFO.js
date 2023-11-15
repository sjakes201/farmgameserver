module.exports = {
    VALUES: {
        townMemberLimit: 25,
        indivGoalExpiryMS: 1 * 60 * 60 * 1000, // 1 hour
    },
    starterGoals: {
        goal_1: "corn",
        goal_2: "carrot",
        goal_3: "sheep_wool",
        goal_4: "chicken_egg",
        goal_5: "cow_milk",
        goal_6: "hops",
        goal_7: "melon",
        goal_8: "oats"
    },
    upgradeBoosts: {
        growthPerkLevel: [0, 0.05, 0.10, 0.15, 0.20, 0.25],
        partsPerkLevel: [0, 0.25, 0.5, 0.75, 1, 1.5],
        orderRefreshPerkLevel: [0, 0.25, 0.5, 0.75, 1, 1.5],
        animalPerkLevel: [0, 0.05, 0.10, 0.15, 0.20, 0.25],
    },
    goalQuantities: {
        carrot: 30000,
        melon: 900,
        cauliflower: 900,
        pumpkin: 900,
        yam: 6500,
        beet: 12000,
        parsnip: 16000,
        bamboo: 30000,
        hops: 28000,
        corn: 30000,
        potato: 30000,
        blueberry: 40000,
        grape: 35000,
        oats: 64000,
        strawberry: 20000,
        cow_milk: 625,
        chicken_egg: 625,
        duck_egg: 500,
        quail_egg: 250,
        yak_milk: 500,
        sheep_wool: 625,
        goat_milk: 625,
        ostrich_egg: 125,
        llama_wool: 375,
        kiwi_egg: 125,
    },
    individualGoalQuantities: {
        carrot: 3000,
        melon: 120,
        cauliflower: 120,
        pumpkin: 120,
        yam: 650,
        beet: 1000,
        parsnip: 1600,
        bamboo: 3200,
        hops: 2500,
        corn: 3000,
        potato: 3000,
        blueberry: 4000,
        grape: 3400,
        oats: 5000,
        strawberry: 2000,
        cow_milk: 50,
        chicken_egg: 70,
        duck_egg: 50,
        quail_egg: 50,
        yak_milk: 20,
        sheep_wool: 30,
        goat_milk: 50,
        ostrich_egg: 8,
        llama_wool: 20,
        kiwi_egg: 8
    },
    townLevelForPerks: {
        // The town level at which you unlock the level that is the index. For example growthPerk[3] is level x. So you need to be level x to get growthPerk level 3
        // Each perk has 6 total levels, including 0
        growthPerk: [0, 1, 5, 9, 13, 17],
        partsPerk: [0, 2, 6, 10, 14, 18],
        animalPerk: [0, 3, 7, 11, 15, 19],
        orderRefreshPerk: [0, 4, 8, 12, 16, 20]
    },
    // XP needed to get to next level, ex: townLevels[5] is 6000, so to get from level 4 to 5 you need 6000 more XP
    townLevels: [0, 3000, 4000, 5000, 5000, 7000, 8500, 10000, 11000, 12000, 13000, 14500, 16000, 17000, 18000, 19000, 20000, 22000, 24000, 25000, 28000],

}




