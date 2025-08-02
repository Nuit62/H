using PixelCombats.Core;
using PixelCombats.Player;
using PixelCombats.World;
using PixelCombats.Basic;
using PixelCombats.Api.RoomServer.Services.Players;
using UnityEngine;

public class KingOfTheHillMode : GameMode
{
    // Настройки режима
    private const float ZONE_RADIUS = 7f;
    private const int POINTS_PER_SECOND = 5;
    private const int MAX_POINTS_TO_WIN = 100;
    private const int KNIFE_ITEM_ID = 1; // ID ножа в инвентаре
    private const int BLOCK_ITEM_ID = 2; // ID обычных блоков

    // Состояние игры
    private Vector3 zoneCenter;
    private IPlayerApi currentKing;
    private float pointAccumulator;
    private bool gameEnded;

    protected override void OnStart()
    {
        // Настройка карты
        SetupWorld();
        
        // Настройка игроков
        PlayerService.PlayerAdded += OnPlayerAdded;
        PlayerService.PlayerRemoved += OnPlayerRemoved;
        
        // Инициализация зоны
        zoneCenter = new Vector3(
            WorldService.WorldSize.x / 2f,
            WorldService.WorldSize.y / 2f + 5f,
            WorldService.WorldSize.z / 2f
        );
        
        // Создание визуальной зоны
        CreateZoneVisual();
        
        // Настройка интерфейса
        CreateGameUI();
    }

    private void SetupWorld()
    {
        // Очистка существующих объектов
        ObjectService.DestroyAllObjects();
        
        // Создание плоской карты
        for (int x = 0; x < WorldService.WorldSize.x; x++)
        {
            for (int z = 0; z < WorldService.WorldSize.z; z++)
            {
                BlockApi.SetBlock(1, new Vector3Int(x, 0, z)); // ID 1 - базовый блок
            }
        }
    }

    private void OnPlayerAdded(IPlayerApi player)
    {
        // Выдача инвентаря
        player.Inventory.Clear();
        player.Inventory.AddItem(KNIFE_ITEM_ID); // Нож
        player.Inventory.AddItem(BLOCK_ITEM_ID, 100); // 100 блоков
        
        // Настройка спавна
        player.SpawnPosition = GetRandomSpawnPoint();
        player.Spawn();
        
        // Подписка на события
        player.Died += OnPlayerDied;
    }

    private Vector3 GetRandomSpawnPoint()
    {
        // Спавн игроков по краям карты
        return new Vector3(
            Random.Range(0, 2) == 0 ? 5f : WorldService.WorldSize.x - 5f,
            10f,
            Random.Range(0, 2) == 0 ? 5f : WorldService.WorldSize.z - 5f
        );
    }

    private void OnPlayerDied(IPlayerApi player, IPlayerApi killer)
    {
        if (player == currentKing)
        {
            currentKing = null;
            UpdateKingStatus(null);
        }
        
        // Респавн через 3 секунды
        TimerService.Timer(3f, () => 
        {
            if (player.IsConnected && !player.IsAlive)
            {
                player.Spawn();
            }
        });
    }

    protected override void OnUpdate()
    {
        if (gameEnded) return;
        
        // Проверка игроков в зоне
        CheckPlayersInZone();
        
        // Начисление очков королю
        if (currentKing != null)
        {
            pointAccumulator += Time.deltaTime;
            
            if (pointAccumulator >= 1f)
            {
                currentKing.Score += POINTS_PER_SECOND;
                pointAccumulator = 0f;
                
                // Проверка победы
                if (currentKing.Score >= MAX_POINTS_TO_WIN)
                {
                    EndGame(currentKing);
                }
            }
        }
    }

    private void CheckPlayersInZone()
    {
        IPlayerApi newKing = null;
        int playersInZone = 0;

        foreach (var player in PlayerService.GetAllPlayers())
        {
            if (player.IsAlive && Vector3.Distance(player.Position, zoneCenter) < ZONE_RADIUS)
            {
                playersInZone++;
                newKing = player; // Последний игрок в зоне станет королем
            }
        }

        // Если в зоне ровно один игрок
        if (playersInZone == 1 && newKing != currentKing)
        {
            currentKing = newKing;
            UpdateKingStatus(currentKing);
        }
        // Если игроков нет или больше одного
        else if (playersInZone != 1 && currentKing != null)
        {
            currentKing = null;
            UpdateKingStatus(null);
        }
    }

    private void CreateZoneVisual()
    {
        // Создание эффекта зоны
        ObjectService.CreateObject("ZoneEffect", zoneCenter, Quaternion.identity, effect => 
        {
            effect.SetScale(new Vector3(ZONE_RADIUS * 2f, 1f, ZONE_RADIUS * 2f));
            effect.SetMaterial("ZoneMaterial"); // Специальный материал с анимацией
        });
    }

    private void CreateGameUI()
    {
        // Создание UI элементов
        UIService.CreateText("Title", new Vector2(10, 10), "Король горы");
        UIService.CreateProgressBar("KingBar", new Vector2(50, 30), new Vector2(200, 20));
        UIService.CreateText("ScoreText", new Vector2(10, 40), "Очки: 0");
    }

    private void UpdateKingStatus(IPlayerApi king)
    {
        var kingBar = UIService.GetUIElement("KingBar");
        
        if (king != null)
        {
            kingBar.SetValue(king.Score / (float)MAX_POINTS_TO_WIN);
            kingBar.SetColor(Color.yellow);
            UIService.GetUIElement("ScoreText").Text = $"Очки: {king.Score}/{MAX_POINTS_TO_WIN}";
        }
        else
        {
            kingBar.SetValue(0);
            kingBar.SetColor(Color.gray);
            UIService.GetUIElement("ScoreText").Text = "Зона свободна!";
        }
    }

    private void EndGame(IPlayerApi winner)
    {
        gameEnded = true;
        
        // Отображение победителя
        UIService.CreateText("WinnerText", new Vector2(Screen.width/2f - 100, Screen.height/2f), 
            $"{winner.Name} - Король горы!", 24, Color.yellow);
        
        // Завершение игры через 10 секунд
        TimerService.Timer(10f, () => GameModeService.RestartGame());
    }

    protected override void OnDestroy()
    {
        // Отписка от событий
        PlayerService.PlayerAdded -= OnPlayerAdded;
        PlayerService.PlayerRemoved -= OnPlayerRemoved;
        
        foreach (var player in PlayerService.GetAllPlayers())
        {
            player.Died -= OnPlayerDied;
        }
    }
}
