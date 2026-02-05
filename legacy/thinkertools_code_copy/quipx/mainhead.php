<?php session_start();
?>
<div class="mainhead">
	<div class="ttlogo" style="margin-right: 240px;">
		<a href="../home.php"><img src="../images/TTlogo.png" alt="Thinkertools logo" height="48px" /></a>
	</div>
	<div class="navbar">
		<a href="../experience.php">Experience</a>
		<a href="../demos.php">Demos</a>
		<a href="../about.php">About</a>
		<a href="../support.php">Support</a>
		<?php						
			if (isset($_SESSION['userID'])) {
				print ' 
				<div class="dropdown">
					<button class="dropbtn">'; 
					echo($_SESSION['firstname']);
				print '		
					<i class="fa fa-caret-down"></i>
					</button>
					<div class="dropdown-content">
						<a href="../profile.php?action=edit">Profile</a>
						<a href="../messages.php">Messages</a>
						<a href="../teams.php">Teams</a>
						<a href="../history.php">History</a>
						<a href="../home.php?action=logout">Logout</a>
					</div>
				</div>
				';
			}
			else {
				print '<a href="../login.php">Login</a>';
			}
		?>	
	</div>
</div>