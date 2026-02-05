<?php session_start();
	// user account db
	// require('../accountsdb.php');
	// woi db
	// require('woidb.php');
	// parse search input into array
	$searchinput = "";
	$commonwords = array("a", "an", "and", "for", "is", "of", "the", "this", "to", "was", "what", "how", "why", "when", "who", "where");
	if ($_GET['action'] == "search") {
		$searchinput = $_POST['searchinput'];
		// clean search string and explode
		$searchinput = strip_tags($searchinput);
		$searchinput = str_replace("&nbsp;", ' ', $searchinput);
		$searchinput = preg_replace('/\s+/', ' ', $searchinput);
		$searcharray = explode( " ", $searchinput);
		// set new array for cleaned elements
		$array1new = array();
		foreach($searcharray as $element) {
	    	$element = trim($element,".,;:!?()[]{}");
	    	$element = trim($element);
	    	$element = strtolower($element);
	    	$elementcheck = 0;
	    	if (strlen($element) > 20) $elementcheck = 1;
	    	foreach($commonwords as $check) {
	    		if ($element == $check) {
	    			$elementcheck = 1;
	    		}
	    	}
	    	if ($elementcheck == 0) array_push($array1new, $element);
	    }
		// all games by name, random order
		require('woidb.php');
		$gamesarray = array();
		$getGames = $mysqli->query("SELECT game_id, game_name, game_description FROM game ORDER BY RAND();");
		if ($getGames->num_rows > 0) {
		  	while ($games_row = $getGames->fetch_array()) {
		  		$game_id2 = $games_row['game_id'];
		  		// game name array, clean and explode
		  		$game_name2 = stripslashes($games_row['game_name']);
				$game_name2 = strip_tags($game_name2);
				$game_name2 = str_replace("&nbsp;", ' ', $game_name2);
				$game_name2 = preg_replace('/\s+/', ' ', $game_name2);
	  			$namearray2 = explode( " ", $game_name2);
	  			// game description array, clean and explode
	  			$game_description2 = stripslashes($games_row['game_description']);
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
				// clean array elements into new array
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
				$gamesarray[] = array($game_id2, $commoncount);
		  	}
		}
		// initial common elements
		$focusgame = 0; $focuscount = 0;
		// order most to least
		foreach ($gamesarray as $arr) {
		    if ($arr[1] > $focuscount) {
		    	$focusgame = $arr[0];
		    	$focuscount = $arr[1]; 
		    }
		}
		$_SESSION['game_id'] = $focusgame;
	}
	if (isset($_GET['game_id'])) $_SESSION['game_id'] = $_GET['game_id'];
	if (!isset($_SESSION['game_id'])) $_SESSION['game_id'] = 8;
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Web of Inquiry play</title>
		<link rel="stylesheet" href="../main.css" content="text/html; charset=utf-8"/>
		<link rel="stylesheet" href="woi.css" type="text/css" charset="utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="../mainhead.css" content="text/html; charset=utf-8"/>
	</head>
	<body>
		<div class="container">
			<?php 
				require('mainhead.php');
			?>
			<div class="woilogodiv">
				<a href="home.php" class="woilogo">Web of Inquiry</a>
			</div>
			<div class="column" style="width: 650px;">
				<!-- grid -->
				<div class="contentbox blank" style="clear: both; width: 640px; margin-top:12px; padding-left:144px">
					<?php
						require("gridviewtest.php");
					?>
				</div>
				<div class="contentbox blank" style="clear: both;"></div>
				<!-- results -->
				<div class="contentbox woiborder" style="clear: both; width: 640px;">
					<?php 
					if ($game_public == '(public)') {
						print '<div class="contentboxtitle" style="text-align:center">Highlight Game (center cell)</div><br />';
						print '<strong>Question and description</strong><br />'; 
						echo $game_name; print '<br />';
						echo $game_description; print '<br /><br />';
						require('../accountsdb.php');
						$getTeamName = "SELECT teamName FROM ttteam WHERE teamID=?";
						$teamName = $mysqli->execute_query($getTeamName, [$teamID])->fetch_assoc();
						print '<strong>Team</strong><br />';echo stripslashes($teamName['teamName']); print '<br /><br />';
						require('woidb.php');
						$getTemplate = "SELECT template_name FROM template WHERE template_id=?";
						$template = $mysqli->execute_query($getTemplate, [$template_id])->fetch_assoc();
						$template_name = stripslashes($template['template_name']);
						print '<strong>Game name</strong><br />'; echo $template_name; print '<br /><br />';
						print '<strong>Game status</strong><br />';
						echo $turn_text;
					}
					else print 'Games results are private or game is in progress';
					?>
				</div>
			</div>
			<div class="column" style="width: 500px;">
				<?php
					print '
						<form action="grid.php?action=search" method="post" class="form">
						<textarea name="searchinput" type="text" class="textarea" style="min-width:520px; min-height:40px; max-height:72px" maxlength="300" placeholder="search, 300 characters max" required />'.$searchinput.'</textarea>
						<input type="submit" name="submit" class="submitbutton" value="Submit" />
						</form>
					';
				?>
			</div>
		</div>
	</body>
</html>