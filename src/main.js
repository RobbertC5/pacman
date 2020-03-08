//////////////////////////////////////////////////////////////////////////////////////
// Entry Point

window.addEventListener("load", function() {
    loadHighScores();
    initRenderer();
    atlas.create();
    initSwipe();
	var anchor = window.location.hash.substring(1);
	if (anchor == "learn") {
		switchState(learnState);
	}
	else if (anchor == "cheat_pac" || anchor == "cheat_mspac") {
		gameMode = (anchor == "cheat_pac") ? GAME_PACMAN : GAME_MSPACMAN;
		practiceMode = true;
        switchState(newGameState);
		for (var i=0; i<4; i++) {
			ghosts[i].isDrawTarget = true;
			ghosts[i].isDrawPath = true;
		}
		isDrawHeatMap = true;
	}
	else if (anchor == "heatmap_pac" || anchor == "heatmap_mspac") {
		gameMode = (anchor == "heatmap_pac") ? GAME_PACMAN : GAME_MSPACMAN;
		switchState(newGameState);
		isDrawHeatMap = true;
	}
	else {
		switchState(homeState);
	}
    executive.init();
});
