<?php session_start();
	// user account db
	// require('../accountsdb.php');
	// quipx db
	// require('qxdb.php');
	// initialize check variables
	$sessioncheck = 0;
	$teamcheck = 0;
	// check if getsessionID is set, set sessionID
	if (isset($_GET['sessionID'])) $_SESSION['sessionID'] = $_GET['sessionID'];
	if (isset($_SESSION['sessionID']) && isset($_SESSION['userID'])) $sessioncheck = 1;
	if ($sessioncheck == 1) {
		// check if user is on team
		require('qxdb.php');
		$getTeam = "SELECT teamID FROM session WHERE sessionID=?";
		$team = $mysqli->execute_query($getTeam, [$_SESSION['sessionID']])->fetch_assoc();
		require('../accountsdb.php');
		$checkTeamMem = "SELECT teammemID FROM ttteam_mem WHERE teamID=? AND userID=?";
		$mem = $mysqli->execute_query($checkTeamMem, [$team['teamID'], $_SESSION['userID']])->fetch_assoc();
		if (!empty($mem)) {
			$teamcheck = 1;
			// count entries for initializing the chat
			require('qxdb.php');
			$countEntries = "SELECT discussID FROM session_discuss WHERE sessionID=?";
			$entries = $mysqli->execute_query($countEntries, [$_SESSION['sessionID']])->fetch_all(MYSQLI_ASSOC);
			$_SESSION['entryNum'] = count($entries);
	 	}
	}
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Quipx discuss</title>
		<link rel="stylesheet" href="../main.css" content="text/html; charset=utf-8"/>
		<link rel="stylesheet" href="qx.css" content="text/html; charset=utf-8"/>
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
			<div class="qlogodiv">
				<a href="home.php" class="qlogo">Quipx</a>
			</div>
			<div class="sessionnavdiv">
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle current"></div>
					Discuss
				</div>
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle next"></div>
					Reflect
				</div>
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle next"></div>
					Improve
				</div>
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle next"></div>
					Review
				</div>
				<?php 
					$loc = "'reflect.php'" ;
					print ' <button class="button150 finishmargin" onclick="window.location.href='.$loc.';">Finish discussion</button>';
				?>
			</div>
			<div class="column">
				<?php
					if (isset($_SESSION['userID']) && $teamcheck == 1 && $sessioncheck == 1) {
						print '
						<div class="contentbox quipxborder discussbox">
							<div id="results"></div>
						</div>';
						// chat entry
			  			print '<br />
						<form name="myForm" id="myForm" method="post" onsubmit="ajaxFunction(); return false;">
						<textarea id="discussEntry" name="discussEntry" placeholder="add your contribution" class="entrybox quipxborder" style="font-family: sans-serif" required></textarea>
						<br /><br />';
						print '<input type="submit" name="submit" id="submit" class="submitbutton" value="Submit" />';
			            print '</form>';
					}
				?>
			</div>
			<div class="column">
				<?php
					if (!isset($_SESSION['userID'])) {
						print '<div class="toolbox login">
						<a href="../login.php" class="toollink">Login to get started </a>
						</div>';
					}
					elseif ($sessioncheck == 0) {
						print '<div class="toolbox login">
						You must join a session to participate. <br /> <a href="join.php" class="textlink">See available sessions.</a>
						</div>';
					}
					elseif ($teamcheck == 0) {
						print '<div class="toolbox login">
						You must be a team member to participate. <br /> Contact the session creator to add you.
						</div>';
					}
					else {
						print '
						<div class="contentbox quipxborder">';
							require('qxdb.php');
							$getSession = "SELECT subject, objectives, teamID FROM session WHERE sessionID=?";
							$session = $mysqli->execute_query($getSession, [$_SESSION['sessionID']])->fetch_assoc();
							print '<strong>'; echo stripslashes($session['subject']); print '</strong><br />';
							echo stripslashes($session['objectives']); print '<br /><br />'; 
							// team
							require('../accountsdb.php');
							$getTeam = "SELECT teamName FROM ttteam WHERE teamID=?";
							$team = $mysqli->execute_query($getTeam, [$session['teamID']])->fetch_assoc();
							print '<strong>'; echo stripslashes($team['teamName']); print '</strong><br />';
							// members
							$getMembers = "SELECT userID FROM ttteam_mem WHERE teamID=?";
							$mems = $mysqli->execute_query($getMembers, [$session['teamID']])->fetch_all(MYSQLI_ASSOC);
							foreach ($mems as $memkey => $mem) {				
								$getUser = "SELECT firstname, lastname, fontcolor FROM ttuser WHERE userID=?";
								$user = $mysqli->execute_query($getUser, [$mem['userID']])->fetch_assoc();
								print '<span style="color: '.$user['fontcolor'].'; 
								-webkit-text-stroke-width: .25px; -webkit-text-stroke-color: #000000;">'; 
								echo $user['firstname']; print ' '; echo $user['lastname'];
								print '</span><br />';
							}
						print '</div>';
					}
				?> 
			</div>
		</div>
	</body>
</html>
<!-- discussion entries, refresh every 1 sec -->
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
<script language="javascript" type="text/javascript">
	$(document).ready(function() {
	setInterval
	(function() {
		$('#results').load('entries.php'); // results is the div id
		}, 1000); // time to refresh the div in milliseconds
	});
</script>
<!-- discuss entry --> 
<script language="javascript" type="text/javascript">
//Browser Support Code
function ajaxFunction(){
	var ajaxRequest;  // The variable that makes Ajax possible
	
	try{
		// Opera 8.0+, Firefox, Safari
		ajaxRequest = new XMLHttpRequest();
	} catch (e){
		// Internet Explorer Browsers
		try{
			ajaxRequest = new ActiveXObject("Msxml2.XMLHTTP");
		} catch (e) {
			try{
				ajaxRequest = new ActiveXObject("Microsoft.XMLHTTP");
			} catch (e){
				// Something went wrong
				alert("Your browser broke!");
				return false;
			}
		}
	}
	// Create a function that will receive data sent from the server
	ajaxRequest.onreadystatechange = function(){
		if(ajaxRequest.readyState == 4){
			// this div display is not implemented
			var ajaxDisplay = document.getElementById('ajaxDiv');
			ajaxDisplay.innerHTML = ajaxRequest.responseText;
		}
	}
	var entry = document.getElementById('discussEntry').value;
	entry = entry.replace(/\r?\n/g, '<br />');
	entry = entry.replace(/#/g, '%23');
	entry = entry.replace(/&/g, '%26');
	ajaxRequest.open("GET", "discuss_entry.php?discussEntry=" + entry, true);
	ajaxRequest.send(); 
	document.getElementById("myForm").reset();
}
</script>
