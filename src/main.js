//////////////////////////////////////////////////////////////////////////////////////
// Entry Point

window.addEventListener("load", function() {
    loadHighScores();
    initRenderer();
    atlas.create();
		initSwipe();
	// parse get parameter mode
	var getMode = findGetParameter('mode');
	if (getMode == 'cd'){
		ghostAi = GHOST_AI_CD;
	} else if (getMode == 'hard'){
		ghostAi = GHOST_AI_HARD;
	} // else: default is normal
	// load anchor
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

function findGetParameter(parameterName) {
	var result = null,
			tmp = [];
	var items = location.search.substr(1).split("&");
	for (var index = 0; index < items.length; index++) {
			tmp = items[index].split("=");
			if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
	}
	return result;
}
