<?php session_start();
	// user account db
	// require('../accountsdb.php');
	// woi db
	// require('woidb.php');
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
			<div class="column">
				<?php
					if (isset($_SESSION['userID'])) {
						print '
						<div class="contentbox woiborder"> 
							<span class="contentboxtitle">Your games by team</span>
							<br />
							Click to play a game
							<br /><br />';
							require('../accountsdb.php');
							$getTeams = "SELECT teamID FROM ttteam_mem WHERE userID =?";
        					$teams = $mysqli->execute_query($getTeams, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
							if (!empty($teams)) {
								foreach($teams as $team_key => $teamID) {
									$getTeamName = "SELECT teamName FROM ttteam WHERE teamID=?";
									$teamName = $mysqli->execute_query($getTeamName, [$teamID['teamID']])->fetch_assoc();
									print '<strong>'; echo stripslashes($teamName['teamName']); print '</strong><br />';
									require "woidb.php";
									$getGames = "SELECT game_id, game_name FROM game WHERE teamID=?";
									$games = $mysqli->execute_query($getGames, [$teamID['teamID']])->fetch_all(MYSQLI_ASSOC);
									if (count($games) > 0) { 
										foreach($games as $game_key => $game) {
											$game_id = $game['game_id'];
										  	$game_name = stripslashes($game['game_name']);
										  	print '<a href="board.php?game_id='.$game_id.'" class="textlink">'.$game_name.'</a><br />';
										}
									}
									else print 'No games<br />';
									require "../accountsdb.php";
									print '<br />';
								}
							}
						print '</div>
						';
					}
				?>
			</div>
			<div class="column">
				<?php
					if (!isset($_SESSION['userID'])) {
						print '<div class="toolbox login">
						<a href="../login.php" class="toollink">Log in to see your games </a>
						</div>';
					}
				?>
			</div>
		</div>
	</body>
</html>