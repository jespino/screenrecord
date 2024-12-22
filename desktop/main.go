package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"

	"github.com/zserge/lorca"
)

func main() {
	// Create UI with basic HTML passed via data URI
	ui, err := lorca.New("", "", 800, 600)
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
