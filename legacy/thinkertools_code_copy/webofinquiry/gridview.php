<?php session_start();	
	$game_id = $_SESSION['game_id'];
	// clean array common words
	$commonwords = array("a", "an", "and", "for", "is", "of", "the", "this", "to", "was", "what", "how", "why", "when", "who", "where");
	// focus game
	require('woidb.php');
	$getGame = "SELECT * FROM game WHERE game_id=?";
	$game = $mysqli->execute_query($getGame, [$game_id])->fetch_assoc();
	$game_id = $game['game_id'];
	// game name array, clean and explode
	$game_name = stripslashes($game['game_name']);
	$game_name = strip_tags($game_name);
	$game_name = str_replace("&nbsp;", ' ', $game_name);
	$game_name = preg_replace('/\s+/', ' ', $game_name);
	$namearray1 = explode( " ", $game_name);
	// game description array, clean and explode
	$game_description = stripslashes($game['game_description']);
	$game_description = strip_tags($game_description);
	$game_description = str_replace("&nbsp;", ' ', $game_description);
	$game_description = preg_replace('/\s+/', ' ', $game_description);
	$descriptionarray1 = explode( " ", $game_description);
	// get team, template, game info
	$teamID = $game['teamID'];
	$template_id = $game['template_id'];
	$game_public = $game['game_public'];
	if ($game_public == 0) $game_public = '(private)';
	else $game_public = '(public)';
	// get the current game results turntext
	$getTurnTextID = "SELECT turn_id FROM turn WHERE game_id=? ORDER BY turn_id DESC LIMIT 1";
	$turnID = $mysqli->execute_query($getTurnTextID, [$game_id])->fetch_assoc();
	$turn_id = $turnID['turn_id'];
	$getTurnText = "SELECT turn_text FROM turn_text WHERE turn_id=?";
	$turnText = $mysqli->execute_query($getTurnText, [$turn_id])->fetch_assoc();
	$turn_text = $turnText['turn_text'];
	// clean text and explode
	$turn_text = stripslashes($turn_text);
	$textarray1 = explode( " ", $turn_text);
	// set array and clean
	$array1 = array_merge($namearray1, $descriptionarray1, $textarray1);
	$array1new = array();
	foreach($array1 as $element) {
    	$element = trim($element,".,;:!?()[]{}");
    	$element = trim($element);
    	$element = strtolower($element);
    	$elementcheck = 0;
    	if (strlen($element) > 20) $elementcheck = 1;
    	if ($element == "") $elementcheck = 1;
    	foreach($commonwords as $check) {
    		if ($element == $check) {
    			$elementcheck = 1;
    		}
    	}
    	if ($elementcheck == 0) array_push($array1new, $element);
    }
		
	// other games, random order
	$getGames = "SELECT * FROM game WHERE game_id !=? ORDER BY RAND();";
	$games = $mysqli->execute_query($getGames, [$game_id])->fetch_all(MYSQLI_ASSOC);
	if (!empty($games)) {
    	foreach($games as $game_key => $game){
    		$game_id2 = $game['game_id'];
    		// game name array, clean and explode
	  		$game_name2 = stripslashes($game['game_name']);
	  		$game_name2 = strip_tags($game_name2);
			$game_name2 = str_replace("&nbsp;", ' ', $game_name2);
			$game_name2 = preg_replace('/\s+/', ' ', $game_name2);
	  		$namearray2 = explode( " ", $game_name2);
	  		// game description array, clean and explode
	  		$game_description2 = stripslashes($game['game_description']);
	  		$game_description2 = strip_tags($game_description2);
			$game_description2 = str_replace("&nbsp;", ' ', $game_description2);
			$game_description2 = preg_replace('/\s+/', ' ', $game_description2);
	  		$descriptionarray2 = explode( " ", $game_description2);
	  		//combine name and description
	  		$array2 = array_merge($namearray2, $descriptionarray2);
  			// get the current game results turntext if any
			$getTurnTextID = "SELECT turn_id FROM turn WHERE game_id=? ORDER BY turn_id DESC LIMIT 1";
			$turnID = $mysqli->execute_query($getTurnTextID, [$game_id2])->fetch_assoc();
			if (!empty($turnID)) {
				$turn_id = $turnID['turn_id'];
				$getTurnText = "SELECT turn_text FROM turn_text WHERE turn_id=?";
				$turnText = $mysqli->execute_query($getTurnText, [$turn_id])->fetch_assoc();
				$turn_text_2 = $turnText['turn_text'];
				// clean and explode text
				$turn_text_2 = stripslashes($turn_text_2);
				$turn_text_2 = strip_tags($turn_text_2);
				$turn_text_2 = str_replace("&nbsp;", ' ', $turn_text_2);
				$turn_text_2 = preg_replace('/\s+/', ' ', $turn_text_2);
				$textarray2 = explode( " ", $turn_text_2);
				// add text to array
				$array2 = array_merge($array2, $textarray2);
			}
	  		// clean array
			$array2new = array();
			foreach($array2 as $element) {
		    	$element = trim($element,".,;:!?()[]{}");
		    	$element = trim($element);
		    	$element = strtolower($element);
		    	$elementcheck = 0;
		    	if (strlen($element) > 20) $elementcheck = 1;
		    	if ($element == "") $elementcheck = 1;
		    	foreach($commonwords as $check) {
		    		if ($element == $check) {
		    			$elementcheck = 1;
		    		}
		    	}
		    	if ($elementcheck == 0) array_push($array2new, $element);
		    }
			// get common elements
			$common = array_intersect($array1new, $array2new);
			$commoncount=count($common);
			$gridarray[] = array($game_id2, $commoncount);
    	}
    }
	// sort
	$commonsort = array();
	foreach ($gridarray as $item) {
	    array_push($commonsort, $item[1]);
	}
	rsort($commonsort);
	$gamesort = array();
	foreach (array_unique($commonsort) as $match) {
	    foreach ($gridarray as $item) {
	    	if ($match ==  $item[1] && $match > 0) {
	    		array_push($gamesort, $item[0]);
	    	}
		}
	}
	$n = 8;
		array_splice($gamesort, $n);	
		$i = 1;
	foreach ($gamesort as $game) {
		if ($i == 1) {
			$getGame = $mysqli->query("SELECT * FROM game WHERE game_id=".$game."");
			if ($getGame->num_rows > 0) {
		  		while ($game_row = $getGame->fetch_array()) {
		  			$game1 = $game;
		  			$game1_name = stripslashes($game_row['game_name']);
		  			$game1_public = $game_row['game_public'];
		  			if ($game1_public == 0) $game1_public = '(private)';
		  			else $game1_public = '(public)';
		  		}
			}
		}
		if ($i == 2) {
			$getGame = $mysqli->query("SELECT * FROM game WHERE game_id=".$game."");
			if ($getGame->num_rows > 0) {
		  		while ($game_row = $getGame->fetch_array()) {
		  			$game2 = $game;
		  			$game2_name = stripslashes($game_row['game_name']);
		  			$game2_public = $game_row['game_public'];
		  			if ($game2_public == 0) $game2_public = '(private)';
		  			else $game2_public = '(public)';
		  		}
			}
		}
		if ($i == 3) {
			$getGame = $mysqli->query("SELECT * FROM game WHERE game_id=".$game."");
			if ($getGame->num_rows > 0) {
		  		while ($game_row = $getGame->fetch_array()) {
		  			$game3 = $game;
		  			$game3_name = stripslashes($game_row['game_name']);
		  			$game3_public = $game_row['game_public'];
		  			if ($game3_public == 0) $game3_public = '(private)';
		  			else $game3_public = '(public)';
		  		}
			}
		}
		if ($i == 4) {
			$getGame = $mysqli->query("SELECT * FROM game WHERE game_id=".$game."");
			if ($getGame->num_rows > 0) {
		  		while ($game_row = $getGame->fetch_array()) {
		  			$game4 = $game;
		  			$game4_name = stripslashes($game_row['game_name']);
		  			$game4_public = $game_row['game_public'];
		  			if ($game4_public == 0) $game4_public = '(private)';
		  			else $game4_public = '(public)';
		  		}
			}
		}
		if ($i == 5) {
			$getGame = $mysqli->query("SELECT * FROM game WHERE game_id=".$game."");
			if ($getGame->num_rows > 0) {
		  		while ($game_row = $getGame->fetch_array()) {
		  			$game5 = $game;
		  			$game5_name = stripslashes($game_row['game_name']);
		  			$game5_public = $game_row['game_public'];
		  			if ($game5_public == 0) $game5_public = '(private)';
		  			else $game5_public = '(public)';
		  		}
			}
		}
		if ($i == 6) {
			$getGame = $mysqli->query("SELECT * FROM game WHERE game_id=".$game."");
			if ($getGame->num_rows > 0) {
		  		while ($game_row = $getGame->fetch_array()) {
		  			$game6 = $game;
		  			$game6_name = stripslashes($game_row['game_name']);
		  			$game6_public = $game_row['game_public'];
		  			if ($game6_public == 0) $game6_public = '(private)';
		  			else $game6_public = '(public)';
		  		}
			}
		}
		if ($i == 7) {
			$getGame = $mysqli->query("SELECT * FROM game WHERE game_id=".$game."");
			if ($getGame->num_rows > 0) {
		  		while ($game_row = $getGame->fetch_array()) {
		  			$game7 = $game;
		  			$game7_name = stripslashes($game_row['game_name']);
		  			$game7_public = $game_row['game_public'];
		  			if ($game7_public == 0) $game7_public = '(private)';
		  			else $game7_public = '(public)';
		  		}
			}
		}
		if ($i == 8) {
			$getGame = $mysqli->query("SELECT * FROM game WHERE game_id=".$game."");
			if ($getGame->num_rows > 0) {
		  		while ($game_row = $getGame->fetch_array()) {
		  			$game8 = $game;
		  			$game8_name = stripslashes($game_row['game_name']);
		  			$game8_public = $game_row['game_public'];
		  			if ($game8_public == 0) $game8_public = '(private)';
		  			else $game8_public = '(public)';
		  		}
			}
		}
		$i = $i + 1;
	}
?>
<!-- grid -->
<div class="griddiv">
	<div class="gridrow">
		<div class="gridcell grid5"><?php print '<br /><a href="home.php?game_id='.$game5.'" class="leveltext ">'; echo $game5_name; print '</a><br /><br />'; echo $game5_public ?></div>
		<div class="gridcell grid1"><?php print '<br /><a href="home.php?game_id='.$game1.'" class="leveltext">'; echo $game1_name; print '</a><br /><br />'; echo $game1_public ?></div>
		<div class="gridcell grid6"><?php print '<br /><a href="home.php?game_id='.$game6.'" class="leveltext">'; echo $game6_name; print '</a><br /><br />'; echo $game6_public ?></div>
	</div>
	<div class="gridrow gridadjust">
		<div class="gridcell grid3"><?php print '<br /><a href="home.php?game_id='.$game3.'" class="leveltext">'; echo $game3_name; print '</a><br /><br />'; echo $game3_public ?></div>
		<div class="gridcell grid0"><br />
			<?php 
				if ($game_id==0) print '<br /><br />no matches';
				else { echo $game_name; print '<br /><br />'; echo $game_public; }
			 ?>
		</div>
		<div class="gridcell grid4"><?php print '<br /><a href="home.php?game_id='.$game4.'" class="leveltext">'; echo $game4_name; print '</a><br /><br />'; echo $game4_public ?></div>
	</div>
	<div class="gridrow gridadjust">
		<div class="gridcell grid8"><?php print '<br /><a href="home.php?game_id='.$game8.'" class="leveltext">'; echo $game8_name; print '</a><br /><br />'; echo $game8_public ?></div>
		<div class="gridcell grid2"><?php print '<br /><a href="home.php?game_id='.$game2.'" class="leveltext">'; echo $game2_name; print '</a><br /><br />'; echo $game2_public ?></div>
		<div class="gridcell grid7"><?php print '<br /><a href="home.php?game_id='.$game7.'" class="leveltext">'; echo $game7_name; print '</a><br /><br />'; echo $game7_public ?></div>
	</div>
</div>