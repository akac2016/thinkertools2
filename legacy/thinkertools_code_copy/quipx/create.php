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
		<title>Quipx create</title>
		<link rel="stylesheet" href="../main.css" content="text/html; charset=utf-8"/>
		<link rel="stylesheet" href="qx.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="../mainhead.css" content="text/html; charset=utf-8"/>
		<!-- select style -->
		<style>
			.selectblack {
				color: black;
			}
			.selectgray {
				color: gray;
			}
		</style>
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
				<div class="contentbox blank">
					<?php
						if (isset($_SESSION['userID'])) {
							// insert a new session
							if ($_GET['action'] == 'insert') {
								$created = date('Y-m-d H:i:s');
								require "qxdb.php";
								$stmt = $mysqli->prepare("INSERT INTO session (userID, teamID, subject, created, month, day, year, hour, minute, ampm, zone, duration_hours, duration_minutes, objectives) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
							  	$stmt->bind_param("iissssssssssss", $_SESSION['userID'], $_POST['teamID'], $_POST['subject'], $created, $_POST['month'], $_POST['day'], $_POST['year'], $_POST['hour'], $_POST['minute'], $_POST['ampm'], $_POST['zone'], $_POST['duration_hours'], $_POST['duration_minutes'], $_POST['objectives']);
							  	$stmt->execute();
							  	$stmt->close();
							  	sleep(1);
							  	// get sessionID
							  	$getSession = "SELECT * FROM session WHERE userID=? AND created=?";
								$session = $mysqli->execute_query($getSession, [$_SESSION['userID'], $created])->fetch_assoc();
							  	print 'Your session is set up <br /><br />'; 
							  	print 'Subject: '; echo stripslashes($session['subject']); 
					  			print '<br />';
					  			print 'Objectives: '; echo stripslashes($session['objectives']);
					  			print '<br />';
					  			if ($session['month'] > 0 && $session['day'] > 0) {
						  			echo $session['month']; print '/';
						  			echo $session['day']; print '/';
						  			echo $session['year']; print ' ';
					  			}
					  			echo $session['hour']; print ':';
					  			echo $session['minute']; print ' ';
					  			if ($session['ampm'] != "0") { 
					  				echo $session['ampm']; print ' '; 
					  			}
					  			if ($session['zone'] != "none") { 
					  				echo $session['zone']; print ' '; 
					  			}
					  			print ' duration ';
					  			echo $session['duration_hours']; print ':'; echo $session['duration_minutes'];
					  			print '<br /><br />';
					  			print '<a href="discuss.php?sessionID='.$session['sessionID'].'" class="textlink">join the session</a>
					  			 | <a href="modify.php?action=edit&sessionID='.$session['sessionID'].'" class="textlink">modify the session</a>
					  			<br />
					  			<a href="create.php?action=new" class="textlink">create new session</a>
					  			 | <a href="home.php" class="textlink">see all sessions</a>
					  			';
							}
							// new session form
							if ($_GET['action'] == 'new') {
								print '
								<span class="columnheadtitle">Create a new session</span><br />
								<form action="create.php?action=insert" method="post" class="form"> 
								<div class="fielddiv">
									<div class="fieldname">
										Subject
									</div>
									<div class="fieldvalue">
										<input name="subject" type="text" class="inputtext" maxlength="250" placeholder="session topic 250 chars max" required />
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Objectives
									</div>
									<div class="fieldvalue">
										<textarea name="objectives" class="textarea" placeholder="session objectives" required /></textarea>
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
										if (!empty($teams)) {
											foreach($teams as $team_key => $team){
												$getTeamName = "SELECT teamName FROM ttteam WHERE teamID =?";
							        			$teamName = $mysqli->execute_query($getTeamName, [$team['teamID']])->fetch_assoc();
												print '<input name="teamID" type="radio" value="'.$team['teamID'].'" required>';
												echo stripslashes($teamName['teamName']);
												print '<br />';
											}
										}
										else {
											print 'You will need to set up a team to create a Quipx session.'; 
										}
									print '</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Date
									</div>
									<div class="fieldvalue fieldvaluebox">
										<select name = "month" class="select selectblack">
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
										<select name = "day" class="select selectblack">
											<option value = "0">day</option>';
											for($counter = 01; $counter <= 31; $counter++) {
												print '<option value ="'.$counter.'">'.$counter.'</option>';
											}
										print '</select>
										<select name = "year" class="select selectblack">
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
										<select name = "hour" class="select selectblack" style="margin-right:0px">
											<option value = "0">hour</option>';
											for($counter = 1; $counter <= 12; $counter++) {
												print '<option value ="'.$counter.'">'.$counter.'</option>';
											}
										print '</select>
										<select name = "minute" class="select selectblack" style="margin-right:0px">
											<option value = "00">min</option>
											<option value = "00">00</option>
											<option value = "15">15</option>
											<option value = "30">30</option>
											<option value = "45">45</option>
										</select>
										<select name = "ampm" class="select selectblack" style="margin-right:0px">
											<option value = "0">am/pm</option>
											<option value = "AM">AM</option>
											<option value = "PM">PM</option>
										</select>
										<select name = "zone" class="select selectblack" style="margin-right:0px">
											<option value = "local">time zone</option>
											<option value = "local">- US -</option>
											<option value = "ET">ET</option>
											<option value = "CT">CT</option>
											<option value = "PT">PT</option>
											<option value = "AK">AK</option>
											<option value = "HI">HI</option>
											<option value = "local">- all -</option>
											<option value="Midway">Midway</option>
										    <option value="HI">Hawaii</option>
										    <option value="Marquesas">Marquesas</option>
										    <option value="AK">Alaska</option>
										    <option value="Ensenada">Ensedada</option>
										    <option value="PT">Pacific US & Canada</option>
										    <option value="MT">Mountain US & Canada</option>
										    <option value="Chihuahua">Chihuahua</option>
										    <option value="AZ">Arizona</option>
										    <option value="Mexico_City">Mexico City</option>
										    <option value="Chile">Chile</option>
										    <option value="CT">Central US & Canada</option>
										    <option value="ET">Eastern US & Canada</option>
										    <option value="Havana">Havana</option>
										    <option value="Bogota">Bogota</option>
										    <option value="Caracas">Caracas</option>
										    <option value="Santiago">Santiago</option>
										    <option value="La_Paz">La Paz</option>
										    <option value="Brazil">Brazil</option>
										    <option value="Atlantic">Atlantic Canada</option>
										    <option value="Newfoundland">Newfoundland</option>
										    <option value="Montevideo">Montevideo</option>
										    <option value="Greenland">Greenland</option>
										    <option value="Buenos_Aires">Buenos Aires</option>
										    <option value="Azores">Azores</option>
										    <option value="GMT">Greenwich Mean Time</option>
										    <option value="Europe">Europe</option>
										    <option value="Cairo">Cairo</option>
										    <option value="Moscow">Moscow</option>
										    <option value="Nairobi">Nairobi</option>
										    <option value="Tehran">Tehran</option>
										    <option value="Dubai">Dubai</option>
										    <option value="Kabul">Kabul</option>
										    <option value="Tashkent">Tashkent</option>
										    <option value="Mumbai">Mumbai</option>
										    <option value="Katmandu">Kathmandu</option>
										    <option value="Dhaka">Dhaka</option>
										    <option value="Rangoon">Yangon (Rangoon)</option>
										    <option value="Bangkok">Bangkok</option>
										    <option value="Hong_Kong">Hong Kong, Beijing</option>
										    <option value="Irkutsk">Irkutsk</option>
										    <option value="Perth">Perth</option>
										    <option value="Eucla">Eucla</option>
										    <option value="Tokyo">Tokyo, Seoul</option>
										    <option value="Adelaide">Adelaide</option>
										    <option value="Darwin">Darwin</option>
										    <option value="Brisbane">Brisbane</option>
										    <option value="Magadan">Magadan</option>
										    <option value="Norfolk">Norfolk</option>
										    <option value="Auckland">Auckland</option>
										    <option value="Chatham">Chatham</option>
										    <option value="Tongatapu">Tongatapu</option>
										    <option value="Kiritimati">Kiritimati</option>
										</select>
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Duration
									</div>
									<div class="fieldvalue fieldvaluebox">
										<select name = "duration_hours" class="select selectblack">
											<option value = "0">hours</option>
											<option value = "0">0</option>
											<option value = "1">1</option>
											<option value = "2">2</option>
											<option value = "3">3</option>
											<option value = "4">4</option>
											<option value = "5">5</option>
											<option value = "6">6</option>
											<option value = "7">7</option>
											<option value = "8">8</option>
										</select>
										<select name = "duration_minutes" class="select selectblack">
											<option value = "00">minutes</option>
											<option value = "00">00</option>
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
					?>
				</div>
			</div>
			<div class="column">
				<?php
					if (!isset($_SESSION['userID'])) {
						print '<div class="toolbox login">
						<a href="../login.php" class="toollink">Login to get started</a>
						</div>';
					}
				?>
			</div>
		</div>
	</body>
</html>
