 
const POINTS_PER_SECOND = 5;
const MAX_POINTS_TO_WIN = 100;
const KNIFE_ITEM_ID = 1;
const BLOCK_ITEM_ID = 2;

class KingOfTheHillMode {
    constructor() {
        this.zoneCenter = null;
        this.currentKing = null;
        this.pointAccumulator = 0;
        this.gameEnded = false;
        this.zoneEffect = null;
    }

    async onStart() {
        // Настройка мира
        await this.setupWorld();
        
        // Инициализация зоны
        const worldSize = await PixelCombats.World.getWorldSize();
        this.zoneCenter = {
            x: worldSize.x / 2,
            y: worldSize.y / 2 + 5,
            z: worldSize.z / 2
        };
        
        // Создание визуала зоны
        this.createZoneVisual();
        
        // Настройка игроков
        PixelCombats.Player.onPlayerAdded(this.handlePlayerAdded.bind(this));
        PixelCombats.Player.onPlayerRemoved(this.handlePlayerRemoved.bind(this));
        
        // Создание UI
        this.createGameUI();
        
        // Запуск игрового цикла
        this.gameLoop();
    }

    async setupWorld() {
        // Очистка карты
        await PixelCombats.World.clearAllBlocks();
        
        // Создание плоской поверхности
        const worldSize = await PixelCombats.World.getWorldSize();
        for (let x = 0; x < worldSize.x; x++) {
            for (let z = 0; z < worldSize.z; z++) {
                await PixelCombats.World.setBlock(x, 0, z, 1); // Базовый блок
            }
        }
    }

    async handlePlayerAdded(player) {
        // Выдача инвентаря
        await player.inventory.clear();
        await player.inventory.addItem(KNIFE_ITEM_ID);
        await player.inventory.addItem(BLOCK_ITEM_ID, 100);
        
        // Настройка спавна
        const spawnPoint = this.getRandomSpawnPoint();
        player.setSpawnPosition(spawnPoint);
        await player.spawn();
        
        // Подписка на смерть игрока
        player.onDied(this.handlePlayerDeath.bind(this, player));
    }

    handlePlayerRemoved(player) {
        if (player === this.currentKing) {
            this.currentKing = null;
            this.updateKingStatus(null);
        }
    }

    getRandomSpawnPoint() {
        const worldSize = PixelCombats.World.getWorldSize();
        return {
            x: Math.random() > 0.5 ? 5 : worldSize.x - 5,
            y: 10,
            z: Math.random() > 0.5 ? 5 : worldSize.z - 5
        };
    }

    async handlePlayerDeath(player, killer) {
        if (player === this.currentKing) {
            this.currentKing = null;
            this.updateKingStatus(null);
        }
        
        // Респавн через 3 секунды
        setTimeout(async () => {
            if (await player.isConnected() && !(await player.isAlive())) {
                await player.spawn();
            }
        }, 3000);
    }

    async gameLoop() {
        while (true) {
            await this.delay(100); // 10 FPS
            
            if (this.gameEnded) continue;
            
            // Проверка игроков в зоне
            await this.checkPlayersInZone();
            
            // Начисление очков
            if (this.currentKing) {
                this.pointAccumulator += 0.1;
                
                if (this.pointAccumulator >= 1) {
                    const newScore = await this.currentKing.getScore() + POINTS_PER_SECOND;
                    await this.currentKing.setScore(newScore);
                    this.pointAccumulator = 0;
                    
                    // Проверка победы
                    if (newScore >= MAX_POINTS_TO_WIN) {
                        await this.endGame(this.currentKing);
                    }
                }
                
                this.updateKingStatus(this.currentKing);
            }
        }
    }

    async checkPlayersInZone() {
        const players = await PixelCombats.Player.getAllPlayers();
        let playersInZone = 0;
        let newKing = null;
        
        for (const player of players) {
            if (await player.isAlive()) {
                const position = await player.getPosition();
                const distance = Math.sqrt(
                    Math.pow(position.x - this.zoneCenter.x, 2) +
                    Math.pow(position.y - this.zoneCenter.y, 2) +
                    Math.pow(position.z - this.zoneCenter.z, 2)
                );
                
                if (distance < ZONE_RADIUS) {
                    playersInZone++;
                    newKing = player;
                }
            }
        }
        
        // Обновление статуса короля
        if (playersInZone === 1 && newKing !== this.currentKing) {
            this.currentKing = newKing;
            this.updateKingStatus(this.currentKing);
        } else if (playersInZone !== 1 && this.currentKing) {
            this.currentKing = null;
            this.updateKingStatus(null);
        }
    }

    async createZoneVisual() {
        // Создание эффекта зоны
        this.zoneEffect = await PixelCombats.Objects.createObject("zone_effect", {
            position: this.zoneCenter,
            scale: {x: ZONE_RADIUS * 2, y: 1, z: ZONE_RADIUS * 2},
            material: "zone_material"
        });
    }

    async createGameUI() {
        // Создание элементов интерфейса
        this.titleElement = await PixelCombats.UI.createText({
            id: "koth_title",
            position: {x: 10, y: 10},
            text: "Король горы",
            fontSize: 18
        });
        
        this.kingBar = await PixelCombats.UI.createProgressBar({
            id: "koth_progress",
            position: {x: 50, y: 30},
            size: {width: 200, height: 20},
            value: 0,
            color: "#888888"
        });
        
        this.scoreText = await PixelCombats.UI.createText({
            id: "koth_score",
            position: {x: 10, y: 40},
            text: "Зона свободна!",
            fontSize: 14
        });
    }

    async updateKingStatus(king) {
        if (king) {
            const score = await king.getScore();
            await this.kingBar.setValue(score / MAX_POINTS_TO_WIN);
            await this.kingBar.setColor("#FFFF00"); // Желтый
            await this.scoreText.setText(`Очки: ${score}/${MAX_POINTS_TO_WIN}`);
        } else {
            await this.kingBar.setValue(0);
            await this.kingBar.setColor("#888888"); // Серый
            await this.scoreText.setText("Зона свободна!");
        }
    }

    async endGame(winner) {
        this.gameEnded = true;
        
        // Отображение победителя
        await PixelCombats.UI.createText({
            id: "winner_text",
            position: {x: PixelCombats.Screen.width / 2 - 100, y: PixelCombats.Screen.height / 2},
            text: `${await winner.getName()} - Король горы!`,
            fontSize: 24,
            color: "#FFFF00",
            duration: 10
        });
        
        // Перезапуск игры через 10 секунд
        setTimeout(async () => {
            await PixelCombats.Game.restart();
        }, 10000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async onDestroy() {
        // Очистка ресурсов
        if (this.zoneEffect) {
            await PixelCombats.Objects.destroyObject(this.zoneEffect);
        }
        
        await PixelCombats.UI.destroyElement("koth_title");
        await PixelCombats.UI.destroyElement("koth_progress");
        await PixelCombats.UI.destroyElement("koth_score");
    }
}

// Регистрация режима игры
PixelCombats.GameMode.register(new KingOfTheHillMode());
