<?php
	// start session
	session_start();
?>
<html>
    <head>
        <meta charset="utf-8">
        <title>Web of Inquiry - Dashboard</title>
    </head>
    <body style="margin: 20px; font-family: arial;">
		Web of Inquiry Dashboard<br />
		<a href="../index.php">home</a> | game library | FAQs | demos | help | I'm curious about -> [search games]
		<br /><br />
		<?php
			// logged in
			if (isset($_SESSION['userID'])) {
				// get name
				require "../accountsdb.php";
				$getuser = $mysqli->query("SELECT userID, username, firstname, lastname FROM ttuser WHERE userID = ".$_SESSION['userID']."");
				if ($getuser->num_rows > 0) {
					$row = $getuser->fetch_array();
					echo $row['username']; print ' (';
					echo $row['firstname']; print ' ';
					echo $row['lastname']; print ') <br />';
				}
				// nav
				print 'play my games | build new game | <a href="../index.php?action=logout">log out</a><br /><br />';
			}
			// not logged in
			else print '<a href="../index.php">log in (Thinkertools)</a>';
		?>
	</body>
</html>