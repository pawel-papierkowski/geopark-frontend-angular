import { Component } from '@angular/core';

import { projectProp } from "@/shared/config/const";

@Component({
  selector: 'app-footer',
  templateUrl: './app-footer.html',
  styleUrl: './app-footer.css',
})
export class AppFooter {
  projectProp = projectProp;
}
