module.exports = {
    VALUES: {
        FEED_COOLDOWN: 600000,
        MAX_HAPPINESS: 1.2
    },
    FoodHappinessYields: {
        carrot: 0.05,
        melon: 0.05,
        cauliflower: 0.05,
        pumpkin: 0.05,
        yam: 0.05,
        beet: 0.05,
        parsnip: 0.05,
        bamboo: 0.05,
        hops: 0.05,
        corn: 0.05,
        potato: 0.05,
        blueberry: 0.05,
        grape: 0.05,
        oats: 0.05,
        strawberry: 0.05,
    },
    // if nothing in a like/dislike array, put 'EMPTY' for spacing 
    foodPreferences: {
        "cow": {
            like: ['oats'],
            dislike: ['melon', 'blueberry']
        },
        "chicken": {
            like: ['carrot', 'corn'],
            dislike: ['grape']
        },
        "duck": {
            like: ['grape', 'corn'],
            dislike: ['pumpkin', 'potato']
        },
        "quail": {
            like: ['grape', 'blueberry'],
            dislike: ['yam']
        },
        "yak": {
            like: ['cauliflower', 'yam'],
            dislimelonke: ['bamboo', 'strawberry']
        },
        "sheep": {
            like: ['oats', 'parsnip'],
            dislike: ['blueberry']
        },
        "goat": {
            like: ['oats', 'carrot', 'parsnip'],
            dislike: ['hops', 'beet']
        },
        "ostrich": {
            like: ['cauliflower'],
            dislike: ['oats', 'potato']
        },
        "llama": {
            like: ['cauliflower', 'melon'],
            dislike: ['oats']
        },
        "kiwi": {
            like: ['melon'],
            dislike: ['empty']
        },
    }
}




