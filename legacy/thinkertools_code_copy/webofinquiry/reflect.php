<?php session_start();
	// user account db
	// require('../accountsdb.php');
	// woi db
	// require('woidb.php');
	// check session set 
	if (isset($_GET['game_id'])) $_SESSION['game_id'] = $_GET['game_id'];
	if (isset($_SESSION['game_id']) && isset($_SESSION['userID'])) $sessioncheck = 1;
	else $sessioncheck = 0;
	// send message
	if ($_GET['action'] == "message") {
		// sender name
		require('../accountsdb.php');
		$getUserName = "SELECT firstname, lastname FROM ttuser WHERE userID =?";
		$userName = $mysqli->execute_query($getUserName, [$_SESSION['userID']])->fetch_assoc();
		$senderName = stripslashes($userName['firstname']) . " " . stripslashes($userName['lastname']);
		// get teamID
		require('woidb.php');
		$getTeam = "SELECT teamID FROM game WHERE game_id =?";
        $team = $mysqli->execute_query($getTeam, [$_SESSION['game_id']])->fetch_assoc();
        $teamID = $team['teamID'];
		// other message values
		$sentTime = date('Y-m-d H:i:s');
		$subject = "game comment";
		$recInd = 0;  
		$recOrg = 0; 
		$recAll = 0;
		$sessionID = 0;
		// send (insert) message
		require('../accountsdb.php');
		$stmt = $mysqli->prepare("INSERT INTO message (subject, message, sentTime, senderID, senderName, recInd, recTeam, recOrg, recAll, game_id, sessionID) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
	  	$stmt->bind_param("sssisiiiiii", $subject, $_POST['message'], $sentTime, $_SESSION['userID'], $senderName, $recInd, $teamID, $recOrg, $recAll, $_SESSION['game_id'], $sessionID);
	  	$stmt->execute();
	  	$stmt->close();
	}
	// team check
	$teamcheck = 0;
	require('woidb.php');
	$getTeam = "SELECT teamID FROM game WHERE game_id=?";
	$team = $mysqli->execute_query($getTeam, [$_SESSION['game_id']])->fetch_assoc();
	require('../accountsdb.php');	
	$teamcheck = 0;
	$checkTeamMem = "SELECT teammemID FROM ttteam_mem WHERE teamID=? AND userID=?";
	$mem = $mysqli->execute_query($checkTeamMem, [$team['teamID'], $_SESSION['userID']])->fetch_assoc();
	if (!empty($mem)) {
		$teamcheck = 1;
		$teamID = $team['teamID'];
		// game info
		require "woidb.php";
		$getGame = "SELECT * FROM game WHERE game_id=?";
		$game = $mysqli->execute_query($getGame, [$_SESSION['game_id']])->fetch_assoc();
		$game_name = stripslashes($game['game_name']);	
		$game_description = stripslashes($game['game_description']);
		$game_template = $game['template_id'];
		$game_creator = $game['game_creator'];
		$game_public = $game['game_public'];
	}
	// on finish game action redirect
 	if ($_GET['action'] == 'public' AND $game_public == 1) {
 		header('Location: home.php');
 	}
 	if ($_GET['action'] == 'public' AND $game_creator != $_SESSION['userID']) {
 		header('Location: home.php');
 	}
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Web of Inquiry reflect</title>
		<link rel="stylesheet" href="../main.css" content="text/html; charset=utf-8"/>
		<link rel="stylesheet" href="woi.css" content="text/html; charset=utf-8"/>
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
			<div class="gamenavdiv">
				<div class="gamenavcirclediv">
					<div class="gamenavcircle done"></div>
					Play
				</div>
				<div class="gamenavcirclediv">
					<div class="gamenavcircle current"></div>
					Reflect
				</div>
				<?php 
					$loc = "'reflect.php?action=public'" ;
					print ' <button class="button150 finishmargin" onclick="window.location.href='.$loc.';">Finish reflect</button>';
				?>
			</div>
			<div class="contentbox woiborder" style="margin-top: 24px; width: 640px;">
				<?php
					print '<strong>'; echo $game_name; print '</strong>';
				?>
			</div>
			<?php 
				if ($_GET['action'] == 'public' AND $game_public == 0 AND $game_creator == $_SESSION['userID']) {
			 		print '<div style="width: 1200px; display: inline-block; text-align: center">
				 		<div class="contentbox woiborder" style="width:640px">
				 			<strong>Would you like to make your game results public?</strong>
				 			<br />
				 			<a href="design.php?action=edit&game_id='.$_SESSION['game_id'].'" class="textlink">Yes! Click to publish your game.</a>
				 		</div>
			 		</div>
			 		';
			 	}
			?>
			<div style="width: 1200px; display: inline-block;">
				<div class="contentbox woiborder" style="float: left; width: 640px; height: 334px; overflow-y:auto; margin-right: 24px;">
					<div class="contentboxtitle">Game details and results</div>
					<?php 
					echo $game_description; 
					print '<br /><br />';
					// team
					print '<strong>Team </strong><br />';
					require('../accountsdb.php');
					$getTeam = "SELECT teamName FROM ttteam WHERE teamID =?";
        			$team = $mysqli->execute_query($getTeam, [$teamID])->fetch_assoc();
        			echo stripslashes($team['teamName']);
					print '<br /><br />';
					//template
					require "woidb.php";
					$getTemplate = "SELECT template_name, template_object FROM template WHERE template_id=?";
					$template = $mysqli->execute_query($getTemplate, [$game_template])->fetch_assoc();
					print '<strong>Game name and objective</strong><br />';
					echo stripslashes($template['template_name']);
					print '<br />';
					echo stripslashes($template['template_object']);
					print '<br /><br />';
					print '<strong>Results </strong>';
					$getTurnTextID = "SELECT turn_id FROM turn WHERE game_id=? ORDER BY turn_id DESC LIMIT 1";
					$turnID = $mysqli->execute_query($getTurnTextID, [$_SESSION['game_id']])->fetch_assoc();
					$turn_id = $turnID['turn_id'];
					$getTurnText = "SELECT turn_text FROM turn_text WHERE turn_id=?";
					$turnText = $mysqli->execute_query($getTurnText, [$turn_id])->fetch_assoc();
					echo stripslashes($turnText['turn_text']);
					?>
				</div>
				<!-- grid -->
				<?php
					require("gridview.php");
				?>
				<!-- levels, reflect comments -->
				<div style="width: 1200px; display: inline-block; margin-bottom: 24px;">
					<div class="contentbox woiborder" style="float: left;  width: 640px; height: 450px; overflow-y: auto; margin-right: 24px;">
						<div class="contentboxtitle">Levels and Turns</div>
						<?php
						$getLevels = "SELECT level_id, level_name, level_order FROM template_level WHERE template_id=? AND level_name<>''";
						$levels = $mysqli->execute_query($getLevels, [$game_template])->fetch_all(MYSQLI_ASSOC);
						if (count($levels) > 0) {
							foreach($levels as $level_key => $level) {
								echo $level['level_order']; print ' ';
								print '<a href="reflect.php?level_id='.$level['level_id'].'" class="textlink">'; echo stripslashes($level['level_name']); print '</a><br />';
							}
							print '<br />';
						}
						print '<a href="reflect.php?level_id=0" class="textlink">show all turns</a><br /><br />';
						// turns by level
						if ($_GET['level_id'] > 0) {
							$getLevel = "SELECT level_name, level_object, level_order FROM template_level WHERE level_id=?";
							$level = $mysqli->execute_query($getLevel, [$_GET['level_id']])->fetch_assoc();
							print '<strong>'; echo $level['level_order']; print ' ';
							echo stripslashes($level['level_name']); print '</strong><br />';
							echo stripslashes($level['level_object']); print '<br /><br />';
							// last text by level
							$turn_id = 0;
							$getTurnTextID = "SELECT turn_id FROM turn WHERE game_id=? AND level_id=? ORDER BY turn_id DESC LIMIT 1";
							$turnID = $mysqli->execute_query($getTurnTextID, [$_SESSION['game_id'], $_GET['level_id']])->fetch_assoc();
							if (count($turnID) > 0) {
								$turn_id = $turnID['turn_id'];
								$getTurnText = "SELECT turn_text FROM turn_text WHERE turn_id=?";
								$turnText = $mysqli->execute_query($getTurnText, [$turn_id])->fetch_assoc();
								print '<strong>Level Results</strong><br />';
								echo stripslashes($turnText['turn_text']);
								print '<br />=================<br /><br />';
							}
							// turns
							require('woidb.php');
							$getTurns = "SELECT * FROM turn WHERE game_id=? and level_id=?";
							$turns = $mysqli->execute_query($getTurns, [$_SESSION['game_id'], $_GET['level_id']])->fetch_all(MYSQLI_ASSOC);
							foreach ($turns as $turn_key => $turn) {
								$turn_id = $turn['turn_id'];
					  			$turn_time = $turn['turn_time'];
					  			$move_id = $turn['move_id'];
					  			$rule_id = $turn['rule_id'];
					  			$tool_id = $turn['tool_id'];
					  			// get player username
					  			require('../accountsdb.php');
					  			$user_id = $turn['user_id'];
					  			print '<strong>Player:</strong> ';
					  			$getPlayer = "SELECT firstname FROM ttuser WHERE userID =?";
        						$player = $mysqli->execute_query($getPlayer, [$user_id])->fetch_assoc();
					  			echo stripslashes($player['firstname']); print '<br />';
					  			// turn time
					  	  		print 'Turn time: '; echo $turn_time; print '<br />';
					  	  		require('woidb.php');
					  	  		// get move
					  	  		$getMove = "SELECT move FROM template_move WHERE move_id=?";
					  	  		$move = $mysqli->execute_query($getMove, [$move_id])->fetch_assoc();
					  	  		print 'Move: '; echo stripslashes($move['move']); print '<br />';
					  	  		// get rule
					  	  		if ($rule_id > 0) {
						  	  		$getRule = "SELECT rule FROM template_rule WHERE rule_id=?";
						  	  		$rule = $mysqli->execute_query($getRule, [$rule_id])->fetch_assoc();
					  	  			print 'Rule: '; echo stripslashes($rule['rule']); print '<br />';
					  	  		}
					  			// turn text
					  			$getTurnText = "SELECT turn_text FROM turn_text WHERE turn_id=?";
					  			$turnText = $mysqli->execute_query($getTurnText, [$turn_id])->fetch_assoc();
					  			echo stripslashes($turnText['turn_text']);
					  			print '=================<br /><br />';
							}
						}
						// all turns
						if (isset($_GET['level_id']) AND $_GET['level_id'] == 0) {
							require('woidb.php');
							$getTurns = "SELECT * FROM turn WHERE game_id=?";
							$turns = $mysqli->execute_query($getTurns, [$_SESSION['game_id']])->fetch_all(MYSQLI_ASSOC);
							foreach ($turns as $turn_key => $turn) {
								$turn_id = $turn['turn_id'];
					  			$turn_time = $turn['turn_time'];
					  			$move_id = $turn['move_id'];
					  			$rule_id = $turn['rule_id'];
					  			$tool_id = $turn['tool_id'];
					  			// get player username
					  			require('../accountsdb.php');
					  			$user_id = $turn['user_id'];
					  			print '<strong>Player:</strong> ';
					  			$getPlayer = "SELECT firstname FROM ttuser WHERE userID =?";
        						$player = $mysqli->execute_query($getPlayer, [$user_id])->fetch_assoc();
					  			echo stripslashes($player['firstname']); print '<br />';
					  			// turn time
					  	  		print 'Turn time: '; echo $turn_time; print '<br />';
					  	  		require('woidb.php');
					  	  		// get move
					  	  		$getMove = "SELECT move FROM template_move WHERE move_id=?";
					  	  		$move = $mysqli->execute_query($getMove, [$move_id])->fetch_assoc();
					  	  		print 'Move: '; echo stripslashes($move['move']); print '<br />';
					  	  		// get rule
					  	  		if ($rule_id > 0) {
						  	  		$getRule = "SELECT rule FROM template_rule WHERE rule_id=?";
						  	  		$rule = $mysqli->execute_query($getRule, [$rule_id])->fetch_assoc();
					  	  			print 'Rule: '; echo stripslashes($rule['rule']); print '<br />';
					  	  		}
					  			// turn text
					  			$getTurnText = "SELECT turn_text FROM turn_text WHERE turn_id=?";
					  			$turnText = $mysqli->execute_query($getTurnText, [$turn_id])->fetch_assoc();
					  			echo stripslashes($turnText['turn_text']);
					  			print '=================<br /><br />';
							}
						}
						?>
					</div>
					<div class="contentbox woiborder" style="float: left; width: 480px; height: 450px; overflow-y: auto; ">
						<div class="contentboxtitle">Comments <a href="reflect.php" class="textlink">refresh</a></div> 
						<form action="reflect.php?action=message" method="post" class="form">
							<textarea name="message" class="textarea" placeholder="type comment" style="min-width: 450px;" required /></textarea>
							<input type="submit" name="submit" class="submitbutton" value="Enter" />
						</form>
						<br /><br />
						<?php
							require('../accountsdb.php');
							$getMessages = "SELECT * FROM message WHERE game_id=? ORDER BY messageID DESC";
							$messages = $mysqli->execute_query($getMessages, [$_SESSION['game_id']])->fetch_all(MYSQLI_ASSOC);
							if (!empty($messages)) {
								foreach($messages as $message) {
									echo stripslashes($message['senderName']); print ' ';
									echo $message['sentTime']; print ' ET<br />';
									echo stripslashes($message['message']); 
									print '<br /><br />';
								}
							}
						?>
					</div>
				</div>
			</div>
		</div>
	</body>
</html>