<?php session_start();
	// user account db
	// require('../accountsdb.php');
	// quipx db
	// require('qxdb.php');
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Quipx modify</title>
		<link rel="stylesheet" href="../main.css" content="text/html; charset=utf-8"/>
		<link rel="stylesheet" href="qx.css" type="text/css" charset="utf-8"/>
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
			<div class="column">
				<?php 
					if (isset($_SESSION['userID'])) { 
						if (!isset($_GET['action'])) print '<div class="contentbox blank">
						<span style="text-align: center;">Click on a session to modify it</span>
						</div>';
						// update session
						if ($_GET['action'] == 'update') {
							require "qxdb.php";
							$stmt = $mysqli->prepare("UPDATE session SET teamID=?, subject=?, month=?, day=?, year=?, hour=?, minute=?, ampm=?, zone=?, duration_hours=?, duration_minutes=?, objectives=? WHERE sessionID=?");
						  	$stmt->bind_param("isssssssssssi", $_POST['teamID'], $_POST['subject'], $_POST['month'], $_POST['day'], $_POST['year'], $_POST['hour'], $_POST['minute'], $_POST['ampm'], $_POST['zone'], $_POST['duration_hours'], $_POST['duration_minutes'], $_POST['objectives'], $_GET['sessionID']);
						  	$stmt->execute();
						  	$stmt->close();
						  	print '<br /><br />Session modified sucessfully<br />'; echo stripslashes($_POST['subject']);
						  	print '<br /><br />';
						  	$loc1 = "'discuss.php?sessionID=".$_GET['sessionID']."'";
						  	$loc2 = "'home.php'";
							print '
							<div class="buttondiv">
								<div class="left">
									<button class="button150" onclick="window.location.href='.$loc1.';">Join this session</button>
								</div>
								<div class="right">
									<button class="button150" onclick="window.location.href='.$loc2.';">See all sessions</button>
								</div>
							</div>
							';
						}
						// edit session form
						if ($_GET['action'] == 'edit') {
							// check if admin
							$admincheck = 0;
							require('qxdb.php');
							$getAdmin = "SELECT userID FROM session WHERE sessionID=?";
							$admin = $mysqli->execute_query($getAdmin, [$_GET['sessionID']])->fetch_assoc();
							if ($admin['userID'] == $_SESSION['userID']) {
								$admincheck = 1;
								$getSession = "SELECT * FROM session WHERE sessionID=?";
								$session = $mysqli->execute_query($getSession, [$_GET['sessionID']])->fetch_assoc();
								$sessionID = $session['sessionID'];
								$teamID = $session['teamID'];
								$subject = stripslashes($session['subject']);
								$month = $session['month'];
								$day = $session['day'];
								$year = $session['year'];
								$hour = $session['hour'];
								$minute = $session['minute'];
								$ampm = $session['ampm'];
								$zone = $session['zone'];
								$duration_hours = $session['duration_hours'];
								$duration_minutes = $session['duration_minutes'];
								$objectives = stripslashes($session['objectives']);
							}
							else print 'You must be the session creator to modify it.';
							if ($admincheck == 1) {
								print '
								<form action="modify.php?action=update&sessionID='.$sessionID.'" method="post" class="form"> 
								<div class="fielddiv">
									<div class="fieldname">
										Subject
									</div>
									<div class="fieldvalue">
										<input name="subject" type="text" class="inputtext" maxlength="250" value="'.$subject.'" placeholder="session topic 250 chars max" required />
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Objectives
									</div>
									<div class="fieldvalue">
										<textarea name="objectives" class="textarea" placeholder="session objectives" />'.$objectives.'</textarea>
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Team
									</div>
									<div class="fieldvalue fieldvaluebox">';
										// teams
										require('../accountsdb.php');
										$getTeams = "SELECT teamID FROM ttteam_mem WHERE userID =?";
				        				$teams = $mysqli->execute_query($getTeams, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
										foreach($teams as $team_key => $team){
											if ($team['teamID'] == $teamID) $checked = "checked";
											else $checked = "";
											$getTeamName = "SELECT teamName FROM ttteam WHERE teamID =?";
					        				$teamName = $mysqli->execute_query($getTeamName, [$team['teamID']])->fetch_assoc();
											print '<input name="teamID" type="radio" value="'.$team['teamID'].'" '.$checked.' required>';
											echo stripslashes($teamName['teamName']);
											print '<br />';
										}
									print '</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Date
									</div>
									<div class="fieldvalue fieldvaluebox">
										<select name = "month" class="select">
											<option value = "'.$month.'">'.$month.'</option>
											<option value = "0">month</option>
											<option value = "1">January</option>
											<option value = "2">February</option>
											<option value = "3">March</option>
											<option value = "4">April</option>
											<option value = "5">May</option>
											<option value = "6">June</option>
											<option value = "7">July</option>
											<option value = "8">August</option>
											<option value = "9">September</option>
											<option value = "10">October</option>
											<option value = "11">November</option>
											<option value = "12">December</option>
										</select>
										<select name = "day" class="select">
											<option value = "'.$day.'">'.$day.'</option>
											<option value = "0">day</option>';
											for($counter = 01; $counter <= 31; $counter++) {
												print '<option value ="'.$counter.'">'.$counter.'</option>';
											}
										print '</select>
										<select name = "year" class="select">
											<option value = "'.$year.'">'.$year.'</option>
											<option value = "2025">year</option>
											<option value = "2025">2025</option>
											<option value = "2026">2026</option>
											<option value = "2027">2027</option>
										</select>
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Time
									</div>
									<div class="fieldvalue fieldvaluebox">
										<select name = "hour" class="select">
											<option value = "'.$hour.'">'.$hour.'</option>
											<option value = "0">hour</option>';
											for($counter = 1; $counter <= 12; $counter++) {
												print '<option value ="'.$counter.'">'.$counter.'</option>';
											}
										print '</select>
										<select name = "minute" class="select">
											<option value = "'.$minute.'">'.$minute.'</option>
											<option value = "0">min</option>
											<option value = "0">00</option>
											<option value = "15">15</option>
											<option value = "30">30</option>
											<option value = "45">45</option>
										</select>
										<select name = "ampm" class="select">
											<option value = "'.$ampm.'">'.$ampm.'</option>
											<option value = "0">am/pm</option>
											<option value = "AM">AM</option>
											<option value = "AM">PM</option>
										</select>
										<select name = "zone" class="select">
											<option value = "'.$zone.'">'.$zone.'</option>
											<option value = "none">US zone</option>
											<option value = "ET">ET</option>
											<option value = "CT">CT</option>
											<option value = "PT">PT</option>
											<option value = "AK">AK</option>
											<option value = "HI">HI</option>
										</select>
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Duration
									</div>
									<div class="fieldvalue fieldvaluebox">
										<select name = "duration_hours" class="select">
											<option value = "'.$duration_hours.'">'.$duration_hours.'</option>
											<option value = "0">hours</option>
											<option value = "0">0</option>
											<option value = "1">1</option>
											<option value = "2">2</option>
											<option value = "3">3</option>
											<option value = "4">4</option>
										</select>
										<select name = "duration_minutes" class="select">
											<option value = "'.$duration_minutes.'">'.$duration_minutes.'</option>
											<option value = "0">minutes</option>
											<option value = "0">00</option>
											<option value = "15">15</option>
											<option value = "30">30</option>
											<option value = "45">45</option>
										</select>
									</div>
								</div>
					      		<div class="fielddiv"">
									<div class="fieldname">
									
									</div>
									<div class="fieldvalue">
										<input type="submit" name="submit" class="submitbutton" value="Submit" />
									</div>
								</div>
								</form>
								';
							}
						}
					}
				?>	
			</div>
			<div class="column">
				<?php
					if (!isset($_SESSION['userID'])) {
						print '<div class="toolbox login" style="margin-top:-30px">
						<a href="../login.php" class="toollink">Login to get started </a>
						</div>';
					}
					else {
						print '
						<div class="contentbox quipxborder"> '; 
							print '<div style="width:100%; text-align:center"><strong>Quipx sessions to modify</strong></div>';
							// teams
							require "../accountsdb.php";
							$getTeams = "SELECT teamID FROM ttteam_mem WHERE userID =?";
					        $teams = $mysqli->execute_query($getTeams, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
							if (!empty($teams)) {
								foreach($teams as $team_key => $team){
									require ('../accountsdb.php');
									$getTeamName = "SELECT teamName FROM ttteam WHERE teamID =?";
							        $teamName = $mysqli->execute_query($getTeamName, [$team['teamID']])->fetch_assoc();
									print '<strong>'; echo stripslashes($teamName['teamName']); print '</strong><br />';
									// sessions
									require('qxdb.php');
								    $getSessions = "SELECT sessionID, subject FROM session WHERE teamID=?";
								    $sessions = $mysqli->execute_query($getSessions, [$team['teamID']])->fetch_all(MYSQLI_ASSOC);
								    if (!empty($sessions)) {
										foreach($sessions as $session_key => $session){
										   print '<a href="modify.php?action=edit&sessionID='.$session['sessionID'].'" class="textlink"> '.stripslashes($session['subject']).'</a><br />';
								  		}
								  	}
								  	else print 'no planned sessions<br />';
								  	print '<br />';
								}
							}	
						print '</div>';
					}
				?>
			</div>
		</div>
	</body>
</html>
