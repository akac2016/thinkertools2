<?php session_start();
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Quipx home</title>
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
			<div class="column">
				<div class="contentbox blank">
					<span class="columnheadtitle">Welcome to Quipx</span>
					<br /><br />
					Quipx helps you and your team communicate, reflect, and improve collaboration. For more information see what's in <a href="../about.php" class="textlink">About</a> and <a href="../demos.php" class="textlink">Demos</a>.
					<br />
					<?php
					if (isset($_SESSION['userID'])) {
						$loc1 = "'create.php?action=new'";
						$loc2 = "'modify.php'";
						print '
						<div class="buttondiv">
							<div class="left">
								<button class="button150" onclick="window.location.href='.$loc1.';">Create session</button>
							</div>
							<div class="right">
								<button class="button150" onclick="window.location.href='.$loc2.';">Modify session</button>
							</div>
						</div>
						';
					}
					?>
				</div>
			</div>
			<div class="column">
				<?php
					if (!isset($_SESSION['userID'])) {
						print '<div class="toolbox login">
						<a href="../login.php" class="toollink">Log in to get started </a>
						</div>';
					}
					else {
						print '
						<div class="contentbox quipxborder"> '; 
							print '<div style="width:100%; text-align:center"><strong>Your Quipx sessions</strong></div>';
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
								    $getSessions = "SELECT sessionID, subject, month, day, year, hour, minute, ampm, zone, duration_hours, duration_minutes FROM session WHERE teamID=? ORDER BY sessionID DESC";
								    $sessions = $mysqli->execute_query($getSessions, [$team['teamID']])->fetch_all(MYSQLI_ASSOC);
								    if (!empty($sessions)) {
										foreach($sessions as $session_key => $session){
										   print '<a href="discuss.php?sessionID='.$session['sessionID'].'" class="textlink"> '.stripslashes($session['subject']).'</a> ';
										   print 'm/d/y: '; echo $session['month']; print '/'; echo $session['day']; print '/'; echo $session['year']; print ' '; 
										   echo $session['hour']; print ':'; echo $session['minute']; print ''; echo $session['ampm']; print ' '; echo $session['zone']; print ' (';
										   echo $session['duration_hours']; print ':'; echo $session['duration_minutes']; print ')';
										   print '<br />';
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
