<?php session_start();
require('woidb.php');
$getTurnID = "SELECT turn_id FROM game WHERE game_id=?";
$turnID = $mysqli->execute_query($getTurnID, [$_SESSION['game_id']])->fetch_assoc(); 
$_SESSION['player'] = $turnID['turn_id'];
// show all players
require('woidb.php');
$getTeam = "SELECT teamID, game_creator, template_id FROM game WHERE game_id=?";
$team = $mysqli->execute_query($getTeam, [$_SESSION['game_id']])->fetch_assoc();
$teamID = $team['teamID'];
$game_creator = $team['game_creator'];
require('../accountsdb.php');
$getTeamMem = "SELECT userID FROM ttteam_mem WHERE teamID=?";
$teamMem = $mysqli->execute_query($getTeamMem, [$teamID])->fetch_all(MYSQLI_ASSOC);
foreach ($teamMem as $key => $teamMemID) {
	// echo $teamMemID['userID']; print ' ';
	$getUser = "SELECT firstname, fontcolor FROM ttuser WHERE userID=?";
	$user = $mysqli->execute_query($getUser, [$teamMemID['userID']])->fetch_assoc();
	if ($teamMemID['userID'] == $_SESSION['player']) {
		print '<span style="display: inline-block; border: 1px solid black; padding-left: 2px; padding-right: 2px; color: '.$user['fontcolor'].'; -webkit-text-stroke-width: .25px; -webkit-text-stroke-color: #000000;">';
	}
	elseif ($_SESSION['userID'] == $game_creator) {
		print '<a href="board.php?level_id='.$_SESSION['level_id'].'&turn_id='.$teamMemID['userID'].'&action=select" class="textlink"><span style="color: '.$user['fontcolor'].'; -webkit-text-stroke-width: .25px; -webkit-text-stroke-color: #000000;">';
	}
	else {
		print '<span style="color: '.$user['fontcolor'].'; -webkit-text-stroke-width: .25px; -webkit-text-stroke-color: #000000;">';
	}
	echo $user['firstname']; 
	print '</span>';
	if ($_SESSION['userID'] == $game_creator) {
		print '</a>';
	}
	print ' ';
}
?>