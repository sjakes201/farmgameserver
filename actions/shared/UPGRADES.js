module.exports = {
    // costs for each upgrade, num of upgrade is length 
    // default
    UpgradeCosts: {
        exoticPermit: [10000],
        deluxePermit: [10000],
        barnCollectTimeUpgrade: [7500, 15000],
        barnCollectQuantityUpgrade: [10000, 50000, 250000, 750000],
        barnCapacityUpgrade: [12000, 25000],
        coopCollectTimeUpgrade: [7500, 15000],
        coopCollectQuantityUpgrade: [10000, 50000, 250000, 750000],
        coopCapacityUpgrade: [12000, 25000],
        plantGrowthTimeUpgrade: [10000, 20000],
        plantHarvestQuantityUpgrade: [10000, 50000, 250000, 1000000],
        plantNumHarvestsUpgrade: [15000, 25000],
    },
    UpgradeDescriptions: {
        exoticPermit: ["Exotic Animals", "Allows the farmer to handle exotic animals"],
        deluxePermit: ["Deluxe Crops", "Allows the farmer to plant luxury crops"],
        barnCollectTimeUpgrade: ["Barn Rate", "Increases barn animal production speed"],
        barnCollectQuantityUpgrade: ["Barn Yields", "Increases the yield of barn animals"],
        barnCapacityUpgrade: ["Barn Capacity", "Increases the total barn capacity"],
        coopCollectTimeUpgrade: ["Coop Rate", "Increases Coop animal production speed"],
        coopCollectQuantityUpgrade: ["Coop Yields", "Increases the yield of coop animals"],
        coopCapacityUpgrade: ["Coop Capacity", "Increases the total coop capacity"],
        plantGrowthTimeUpgrade: ["Crop Growth Time", "Decreases total crop growth time"],
        plantHarvestQuantityUpgrade: ["Crop Yields", "Increases per harvest crop yields"],
        plantNumHarvestsUpgrade: ["Crop Harvests", "Increases total harvests for multi harvest crops"],

    },
    // default
    GrowthTimes0: {
        carrot_seeds: [40, 20],
        melon_seeds: [100, 100, 100, 60],
        cauliflower_seeds: [80, 80, 80, 60],
        pumpkin_seeds: [100, 100, 100, 60],
        yam_seeds: [40, 40, 60],
        beet_seeds: [60, 20],
        parsnip_seeds: [30, 30],
        bamboo_seeds: [15, 15, 30],
        hops_seeds: [20, 20, 20],
        corn_seeds: [10, 10, 10, 15],
        potato_seeds: [45, 15],
        blueberry_seeds: [35, 35, 15],
        grape_seeds: [35, 35, 15],
        oats_seeds: [11, 11, 8],
        strawberry_seeds: [20, 20, 20]
    },
    // 1st upgrade 
    GrowthTimes1: {
        carrot_seeds: [25, 15],
        melon_seeds: [60, 60, 60, 40],
        cauliflower_seeds: [66, 66, 66, 60],
        pumpkin_seeds: [80, 100, 80, 50],
        yam_seeds: [32, 33, 50],
        beet_seeds: [55, 20],
        parsnip_seeds: [30, 30],
        bamboo_seeds: [10, 10, 20],
        hops_seeds: [20, 20, 20],
        corn_seeds: [8, 8, 7, 12],
        potato_seeds: [45, 15],
        blueberry_seeds: [22, 23, 15],
        grape_seeds: [22, 23, 15],
        oats_seeds: [8, 8, 6],
        strawberry_seeds: [17, 18, 16]
    },
    // 2nd upgrade 
    GrowthTimes2: {
        carrot_seeds: [22, 13],
        melon_seeds: [55, 60, 60, 37],
        cauliflower_seeds: [60, 60, 60, 60],
        pumpkin_seeds: [80, 80, 100, 50],
        yam_seeds: [25, 30, 40],
        beet_seeds: [50, 18],
        parsnip_seeds: [25, 28],
        bamboo_seeds: [7, 8, 13],
        hops_seeds: [17, 18, 15],
        corn_seeds: [7, 7, 6, 12],
        potato_seeds: [30, 10],
        blueberry_seeds: [17, 18, 8],
        grape_seeds: [18, 17, 8],
        oats_seeds: [5, 5, 4],
        strawberry_seeds: [17, 18, 15]
    },
    // 
    NumHarvests0: {
        carrot_seeds: 2,
        melon_seeds: 1,
        cauliflower_seeds: 1,
        pumpkin_seeds: 1,
        yam_seeds: 1,
        beet_seeds: 1,
        parsnip_seeds: 1,
        bamboo_seeds: 2,
        hops_seeds: 2,
        corn_seeds: 2,
        potato_seeds: 2,
        blueberry_seeds: 3,
        grape_seeds: 3,
        oats_seeds: 3,
        strawberry_seeds: 2
    },
    // 
    NumHarvests1: {
        carrot_seeds: 3,
        melon_seeds: 1,
        cauliflower_seeds: 1,
        pumpkin_seeds: 2,
        yam_seeds: 2,
        beet_seeds: 2,
        parsnip_seeds: 2,
        bamboo_seeds: 3,
        hops_seeds: 3,
        corn_seeds: 2,
        potato_seeds: 3,
        blueberry_seeds: 4,
        grape_seeds: 4,
        oats_seeds: 3,
        strawberry_seeds: 3
    },
    //
    NumHarvests2: {
        carrot_seeds: 3,
        melon_seeds: 1,
        cauliflower_seeds: 2,
        pumpkin_seeds: 2,
        yam_seeds: 2,
        beet_seeds: 2,
        parsnip_seeds: 2,
        bamboo_seeds: 3,
        hops_seeds: 3,
        corn_seeds: 3,
        potato_seeds: 3,
        blueberry_seeds: 5,
        grape_seeds: 5,
        oats_seeds: 4,
        strawberry_seeds: 3
    },
    // 
    PlantQuantityYields0: {
        carrot_seeds: 4,
        melon_seeds: 1,
        cauliflower_seeds: 1,
        pumpkin_seeds: 1,
        yam_seeds: 3,
        beet_seeds: 3,
        parsnip_seeds: 3,
        bamboo_seeds: 5,
        hops_seeds: 4,
        corn_seeds: 3,
        potato_seeds: 4,
        blueberry_seeds: 6,
        grape_seeds: 5,
        oats_seeds: 3,
        strawberry_seeds: 3
    },
    // 
    PlantQuantityYields1: {
        carrot_seeds: 4,
        melon_seeds: 1,
        cauliflower_seeds: 2,
        pumpkin_seeds: 1,
        yam_seeds: 3,
        beet_seeds: 3,
        parsnip_seeds: 4,
        bamboo_seeds: 5,
        hops_seeds: 5,
        corn_seeds: 4,
        potato_seeds: 5,
        blueberry_seeds: 6,
        grape_seeds: 4,
        oats_seeds: 3,
        strawberry_seeds: 3
    },
    //  
    PlantQuantityYields2: {
        carrot_seeds: 5,
        melon_seeds: 2,
        cauliflower_seeds: 2,
        pumpkin_seeds: 2,
        yam_seeds: 4,
        beet_seeds: 4,
        parsnip_seeds: 5,
        bamboo_seeds: 6,
        hops_seeds: 6,
        corn_seeds: 4,
        potato_seeds: 5,
        blueberry_seeds: 6,
        grape_seeds: 5,
        oats_seeds: 4,
        strawberry_seeds: 5
    },
    // how much of an increase in capacity for purchasing that level
    // default 
    CapacityIncreases: {
        Barn: [4, 4, 4],
        Coop: [4, 6, 4]
    },
    // barn and coop upgrades, go to the table for the levels 
    AnimalCollectTimes0: {
        "cow": [120],
        "chicken": [80],
        "duck": [100],
        "quail": [100],
        "yak": [240],
        "sheep": [180],
        "goat": [110],
        "ostrich": [600],
        "llama": [300],
        "kiwi": [500]
    },
    // 
    AnimalProduceMap0: {
        "cow": ["cow_milk", 1],
        "chicken": ["chicken_egg", 1],
        "duck": ["duck_egg", 1],
        "quail": ["quail_egg", 1],
        "yak": ["yak_milk", 1],
        "sheep": ["sheep_wool", 1],
        "goat": ["goat_milk", 1],
        "ostrich": ["ostrich_egg", 1],
        "llama": ["llama_wool", 1],
        "kiwi": ["kiwi_egg", 1]
    },
    // 
    AnimalCollectTimes1: {
        "cow": [100],
        "chicken": [70],
        "duck": [90],
        "quail": [90],
        "yak": [120],
        "sheep": [160],
        "goat": [100],
        "ostrich": [300],
        "llama": [240],
        "kiwi": [240]
    },
    // 
    AnimalProduceMap1: {
        "cow": ["cow_milk", 2],
        "chicken": ["chicken_egg", 2],
        "duck": ["duck_egg", 2],
        "quail": ["quail_egg", 2],
        "yak": ["yak_milk", 1],
        "sheep": ["sheep_wool", 2],
        "goat": ["goat_milk", 2],
        "ostrich": ["ostrich_egg", 1],
        "llama": ["llama_wool", 2],
        "kiwi": ["kiwi_egg", 1]
    },
    // 
    AnimalCollectTimes2: {
        "cow": [80],
        "chicken": [60],
        "duck": [80],
        "quail": [80],
        "yak": [120],
        "sheep": [160],
        "goat": [60],
        "ostrich": [300],
        "llama": [240],
        "kiwi": [140]
    },
    // 
    AnimalProduceMap2: {
        "cow": ["cow_milk", 2],
        "chicken": ["chicken_egg", 3],
        "duck": ["duck_egg", 3],
        "quail": ["quail_egg", 2],
        "yak": ["yak_milk", 2],
        "sheep": ["sheep_wool", 3],
        "goat": ["goat_milk", 2],
        "ostrich": ["ostrich_egg", 2],
        "llama": ["llama_wool", 3],
        "kiwi": ["kiwi_egg", 1]
    },
    AnimalProduceMap3: { // NOT USED EXCEPT TO GRAB PRODUCE NAMES FROM ANIMALS
        "cow": ["cow_milk", 3],
        "chicken": ["chicken_egg", 4],
        "duck": ["duck_egg", 2],
        "quail": ["quail_egg", 3],
        "yak": ["yak_milk", 3],
        "sheep": ["sheep_wool", 3],
        "goat": ["goat_milk", 2],
        "ostrich": ["ostrich_egg", 1],
        "llama": ["llama_wool", 3],
        "kiwi": ["kiwi_egg", 1]
    },
    AnimalProduceMap4: { // NOT USED EXCEPT TO GRAB PRODUCE NAMES FROM ANIMALS
        "cow": ["cow_milk", 3],
        "chicken": ["chicken_egg", 4],
        "duck": ["duck_egg", 2],
        "quail": ["quail_egg", 3],
        "yak": ["yak_milk", 3],
        "sheep": ["sheep_wool", 3],
        "goat": ["goat_milk", 2],
        "ostrich": ["ostrich_egg", 1],
        "llama": ["llama_wool", 3],
        "kiwi": ["kiwi_egg", 1]
    },


}




