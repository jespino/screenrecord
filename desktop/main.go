package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"

	"github.com/zserge/lorca"
)

func checkChrome() error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "linux":
		// Try Chrome first
		cmd = exec.Command("which", "google-chrome")
		if err := cmd.Run(); err != nil {
			// If Chrome not found, try Chromium
			cmd = exec.Command("which", "chromium")
			if err := cmd.Run(); err != nil {
				return fmt.Errorf("neither Chrome nor Chromium is installed. Please install one of them")
			}
		}
	case "darwin":
		cmd = exec.Command("which", "google-chrome")
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("Chrome is not installed. Please install it first")
		}
	case "windows":
		cmd = exec.Command("where", "chrome.exe")
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("Chrome is not installed. Please install it first")
		}
	default:
		return fmt.Errorf("unsupported operating system")
	}
	return nil
}

func main() {
	if err := checkChrome(); err != nil {
		fmt.Println("Error:", err)
		return
	}
	// Create UI with specific Chrome flags
	ui, err := lorca.New("", "", 800, 600, "--start-maximized", "--disable-sync")
	if err != nil {
		fmt.Println("Error creating UI:", err)
		return
	}
	defer ui.Close()

	// Create a temporary listener to get a random free port
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Println("Error creating listener:", err)
		return
	}
	defer ln.Close()
	port := ln.Addr().(*net.TCPAddr).Port

	// Serve static files from the ui directory
	fs := http.FileServer(http.Dir("desktop/ui"))
	http.Handle("/", fs)

	// Start local server
	go http.Serve(ln, nil)

	// Navigate to the local server
	ui.Load(fmt.Sprintf("http://127.0.0.1:%d", port))

	// Wait until the interrupt signal arrives or browser window is closed
	sigc := make(chan os.Signal)
	signal.Notify(sigc, os.Interrupt)
	select {
	case <-sigc:
	case <-ui.Done():
	}
}
