import * as Room from "pixel_combats/room";
import * as Basic from "pixel_combats/basic"

    // по запросу на вход в команду - кидаем игрока в команду
    room.Teams.OnRequestJoinTeam.Add(function (player, team) { team.Add(player); });
    // если игрок сменил команду или выбрал ее, то происходит спавн игрока
    room.Teams.OnPlayerChangeTeam.Add(function (player) { player.Spawns.Spawn(); });
}

    // создание команд на основе параметров
    if (hasRedTeam || (!hasRedTeam && !hasBlueTeam)) {
        teams.create_team_red();
    }
    if (hasBlueTeam || (!hasRedTeam && !hasBlueTeam)) {
        teams.create_team_blue();
    }

// разрешает все что можно для строительства
function set_inventory() {
    const context = room.Inventory.GetContext();
    context.Main.Value = false;
    context.Secondary.Value = false;
    context.Melee.Value = false;
    context.Explosive.Value = false;
    context.Build.Value = false;
}

